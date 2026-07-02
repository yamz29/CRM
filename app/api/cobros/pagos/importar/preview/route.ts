import { NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import {
  validarFilas, type FacturaLookup, type CuentaLookup, type LookupMaps, type FilaRaw,
} from '@/lib/cobros-import'

/**
 * POST /api/cobros/pagos/importar/preview
 * Body: FormData con archivo .xlsx o .csv
 *
 * Parsea y valida cada fila contra las facturas de ingreso y cuentas activas.
 * NO registra nada — devuelve { filas, totales } para que el usuario revise.
 */
export const POST = apiHandler({ modulo: 'contabilidad', nivel: 'editar' }, async (req) => {
  const formData = await req.formData().catch(() => null)
  const file = formData?.get('archivo') as File | null
  if (!file || file.size === 0) {
    throw new ApiError(400, 'No se proporcionó archivo')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new ApiError(400, 'Archivo demasiado grande (máx 5 MB)')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    throw new ApiError(400, 'No se pudo leer el archivo. Verifica que sea Excel o CSV válido.')
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new ApiError(400, 'El archivo no tiene hojas')
  const rows: FilaRaw[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })

  // ── Cargar lookups ──
  const [facturas, cuentas] = await Promise.all([
    prisma.factura.findMany({
      where: { tipo: 'ingreso' },
      select: {
        id: true, numero: true, estado: true, total: true, montoPagado: true,
        clienteId: true,
        cliente: { select: { nombre: true } },
        proyecto: { select: { estado: true } },
      },
    }),
    prisma.cuentaBancaria.findMany({ where: { activa: true }, select: { id: true, nombre: true } }),
  ])

  const facturasPorId = new Map<number, FacturaLookup>()
  const facturasPorNumero = new Map<string, FacturaLookup | 'AMBIGUO'>()
  for (const f of facturas) {
    const lookup: FacturaLookup = {
      id: f.id,
      numero: f.numero,
      estado: f.estado,
      total: f.total,
      montoPagado: f.montoPagado,
      clienteId: f.clienteId,
      clienteNombre: f.cliente?.nombre ?? null,
      proyectoCerrado: f.proyecto?.estado === 'Cerrado',
    }
    facturasPorId.set(f.id, lookup)
    const key = f.numero.toUpperCase().trim()
    if (key) facturasPorNumero.set(key, facturasPorNumero.has(key) ? 'AMBIGUO' : lookup)
  }

  const cuentasPorNombre = new Map<string, CuentaLookup>()
  for (const c of cuentas) cuentasPorNombre.set(c.nombre.toUpperCase().trim(), { id: c.id, nombre: c.nombre })

  const maps: LookupMaps = { facturasPorId, facturasPorNumero, cuentasPorNombre }
  return NextResponse.json(validarFilas(rows, maps))
})
