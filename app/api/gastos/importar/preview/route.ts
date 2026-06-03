import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

interface FilaRaw {
  [key: string]: unknown
}

interface FilaValidada {
  numFila: number  // 1-indexed para que el usuario vea "fila 3" del Excel
  fecha: Date | null
  descripcion: string
  monto: number
  proveedor: string | null
  categoria: string | null
  subcategoria: string | null
  metodoPago: string
  referencia: string | null
  proyectoCodigo: string | null
  proyectoId: number | null
  proyectoNombre: string | null
  destinoTipo: string
  observaciones: string | null
  errores: string[]
}

// ── Normalización de nombres de columnas ──────────────────────────────────

const ALIASES: Record<string, string[]> = {
  fecha:           ['fecha', 'date', 'fec'],
  descripcion:     ['descripcion', 'descripción', 'desc', 'concepto', 'detalle'],
  monto:           ['monto', 'valor', 'total', 'importe', 'amount'],
  proveedor:       ['proveedor', 'suplidor', 'vendor', 'supplier'],
  categoria:       ['categoria', 'categoría', 'category', 'tipo'],
  subcategoria:    ['subcategoria', 'subcategoría', 'subtipo'],
  metodo_pago:     ['metodo_pago', 'metodopago', 'método', 'metodo', 'forma_pago', 'forma de pago'],
  referencia:      ['referencia', 'ref', 'factura', 'recibo', 'documento', 'nro', 'numero'],
  proyecto_codigo: ['proyecto_codigo', 'proyecto', 'codigo_proyecto', 'cod_proyecto', 'cod'],
  destino_tipo:    ['destino_tipo', 'destino', 'tipo_destino'],
  observaciones:   ['observaciones', 'obs', 'notas', 'notes', 'comentarios'],
}

function getCelda(row: FilaRaw, campo: keyof typeof ALIASES): string {
  const aliases = ALIASES[campo] ?? [campo]
  for (const key of Object.keys(row)) {
    const norm = key.toLowerCase().trim().replace(/\s+/g, '_')
    if (aliases.includes(norm)) {
      const v = row[key]
      if (v == null) return ''
      return String(v).trim()
    }
  }
  return ''
}

function parseFecha(raw: string): Date | null {
  if (!raw) return null
  // YYYY-MM-DD
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    return isNaN(d.getTime()) ? null : d
  }
  // DD/MM/YYYY
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
    return isNaN(d.getTime()) ? null : d
  }
  // Excel serial date (raro pero pasa)
  const num = parseFloat(raw)
  if (!isNaN(num) && num > 30000 && num < 80000) {
    // Excel date serial (días desde 1900-01-01, con ajuste por bug 1900)
    const d = new Date(Date.UTC(1899, 11, 30) + num * 86_400_000)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function parseMonto(raw: string): number | null {
  if (!raw) return null
  // Quitar símbolos, mantener dígitos, punto, coma, y signo
  const limpio = raw.replace(/[^\d.,-]/g, '')
  // Si tiene coma Y punto, asumimos coma=miles, punto=decimal
  // Si solo tiene coma, asumimos coma=decimal
  let normalizado: string
  if (limpio.includes(',') && limpio.includes('.')) {
    normalizado = limpio.replace(/,/g, '')
  } else if (limpio.includes(',') && !limpio.includes('.')) {
    normalizado = limpio.replace(',', '.')
  } else {
    normalizado = limpio
  }
  const n = parseFloat(normalizado)
  return isNaN(n) ? null : n
}

/**
 * POST /api/gastos/importar/preview
 * Body: FormData con archivo .xlsx o .csv
 *
 * Parsea el archivo, valida cada fila, mira si el proyecto_codigo existe,
 * y devuelve un preview detallado:
 *   { filas: FilaValidada[], totales: { ok, conErrores, montoOk } }
 *
 * NO inserta nada — solo valida. El usuario revisa y confirma con el endpoint
 * /api/gastos/importar (POST con el JSON validado).
 */
export const POST = withPermiso('gastos', 'editar', async (req: NextRequest) => {
  const formData = await req.formData().catch(() => null)
  const file = formData?.get('archivo') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo. Verifica que sea Excel o CSV válido.' }, { status: 400 })
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return NextResponse.json({ error: 'El archivo no tiene hojas' }, { status: 400 })

  const sheet = workbook.Sheets[sheetName]
  const rows: FilaRaw[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  // ── Pre-cargar proyectos por código para validar ────────────────────────
  const proyectos = await prisma.proyecto.findMany({
    select: { id: true, codigo: true, nombre: true },
    where: { codigo: { not: null } },
  })
  const proyectoPorCodigo = new Map<string, { id: number; nombre: string }>()
  for (const p of proyectos) {
    if (p.codigo) proyectoPorCodigo.set(p.codigo.toUpperCase(), { id: p.id, nombre: p.nombre })
  }

  // ── Validar fila por fila ─────────────────────────────────────────────
  const filas: FilaValidada[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errores: string[] = []

    // Fila vacía: ignorar silenciosamente
    const valoresStr = Object.values(row).map(v => String(v ?? '').trim()).join('')
    if (!valoresStr) continue

    const fechaRaw = getCelda(row, 'fecha')
    const descripcion = getCelda(row, 'descripcion')
    const montoRaw = getCelda(row, 'monto')
    const proveedor = getCelda(row, 'proveedor') || null
    const categoria = getCelda(row, 'categoria') || null
    const subcategoria = getCelda(row, 'subcategoria') || null
    const metodoPago = getCelda(row, 'metodo_pago') || 'Efectivo'
    const referencia = getCelda(row, 'referencia') || null
    const proyectoCodigo = getCelda(row, 'proyecto_codigo').toUpperCase() || null
    const destinoTipoRaw = getCelda(row, 'destino_tipo').toLowerCase() || ''
    const observaciones = getCelda(row, 'observaciones') || null

    const fecha = parseFecha(fechaRaw)
    if (!fecha) errores.push(`Fecha inválida ("${fechaRaw}")`)
    if (!descripcion) errores.push('Falta descripción')
    const monto = parseMonto(montoRaw)
    if (monto == null) errores.push(`Monto inválido ("${montoRaw}")`)
    else if (monto < 0) errores.push('Monto no puede ser negativo')

    let proyectoId: number | null = null
    let proyectoNombre: string | null = null
    if (proyectoCodigo) {
      const found = proyectoPorCodigo.get(proyectoCodigo)
      if (!found) errores.push(`Proyecto "${proyectoCodigo}" no encontrado`)
      else { proyectoId = found.id; proyectoNombre = found.nombre }
    }

    // destino_tipo: si hay proyecto y no se especificó, default 'proyecto'. Si no, 'general'.
    let destinoTipo = destinoTipoRaw
    if (!destinoTipo) destinoTipo = proyectoId ? 'proyecto' : 'general'
    if (!['proyecto', 'oficina', 'taller', 'general', 'sin_asignar'].includes(destinoTipo)) {
      errores.push(`destino_tipo inválido ("${destinoTipoRaw}")`)
      destinoTipo = 'general'
    }
    if (destinoTipo === 'proyecto' && !proyectoId) {
      errores.push('destino_tipo=proyecto requiere proyecto_codigo válido')
    }

    filas.push({
      numFila: i + 2, // +1 por header, +1 por base 1
      fecha, descripcion, monto: monto ?? 0, proveedor, categoria, subcategoria,
      metodoPago, referencia, proyectoCodigo, proyectoId, proyectoNombre,
      destinoTipo, observaciones, errores,
    })
  }

  const ok = filas.filter(f => f.errores.length === 0)
  const conErrores = filas.filter(f => f.errores.length > 0)
  const montoOk = ok.reduce((s, f) => s + f.monto, 0)

  return NextResponse.json({
    filas: filas.map(f => ({ ...f, fecha: f.fecha?.toISOString() ?? null })),
    totales: {
      total: filas.length,
      ok: ok.length,
      conErrores: conErrores.length,
      montoOk,
    },
  })
})
