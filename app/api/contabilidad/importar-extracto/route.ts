import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { parseExtracto } from '@/lib/parse-extracto'

// POST /api/contabilidad/importar-extracto
// Importa movimientos desde TXT Banco Popular, CSV o XLSX.
// Autodetecta el formato. Soporta dos modos:
//
//   1. Subir archivo:
//      multipart/form-data con campos archivo + cuentaId
//
//   2. JSON con rows pre-parseados (viene del preview):
//      { cuentaId, rows: ParsedRow[], formato? }
//
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const contentType = request.headers.get('content-type') || ''

    let cuentaBancariaId: number
    type RowIn = { fecha: string | Date; tipo: string; monto: number; descripcion: string; referencia: string | null }
    let parsedRows: RowIn[] = []
    let warnings: string[] = []
    let formato = 'desconocido'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('archivo') as File | null
      const cuentaIdRaw = formData.get('cuentaId') as string | null

      if (!file || file.size === 0) {
        return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 400 })
      }
      if (!cuentaIdRaw) {
        return NextResponse.json({ error: 'Seleccione una cuenta bancaria' }, { status: 400 })
      }
      cuentaBancariaId = parseInt(cuentaIdRaw)

      const result = await parseExtracto(file)
      parsedRows = result.rows.map(r => ({ ...r, fecha: r.fecha.toISOString() }))
      warnings = result.warnings
      formato = result.formato
    } else {
      const body = await request.json()
      if (!body.cuentaId) {
        return NextResponse.json({ error: 'Seleccione una cuenta bancaria' }, { status: 400 })
      }
      cuentaBancariaId = parseInt(String(body.cuentaId))
      if (!Array.isArray(body.rows)) {
        return NextResponse.json({ error: 'rows inválido' }, { status: 400 })
      }
      parsedRows = body.rows
      formato = body.formato || 'csv'
    }

    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: cuentaBancariaId } })
    if (!cuenta) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    }

    if (parsedRows.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron movimientos válidos',
        warnings,
        formato,
      }, { status: 400 })
    }

    // Normalizar fechas y filtrar inválidos
    const rows = parsedRows.map(r => ({
      fecha: typeof r.fecha === 'string' ? new Date(r.fecha) : r.fecha,
      tipo: r.tipo === 'credito' ? 'credito' : 'debito',
      monto: Number(r.monto),
      descripcion: String(r.descripcion || ''),
      referencia: r.referencia ? String(r.referencia) : null,
    })).filter(r => !isNaN(r.fecha.getTime()) && r.monto > 0)

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'No hay filas válidas después de la normalización',
        formato,
      }, { status: 400 })
    }

    // Detección de duplicados
    const fechaMin = new Date(Math.min(...rows.map(r => r.fecha.getTime())))
    const fechaMax = new Date(Math.max(...rows.map(r => r.fecha.getTime())))
    fechaMax.setHours(23, 59, 59)

    const existentes = await prisma.movimientoBancario.findMany({
      where: { cuentaBancariaId, fecha: { gte: fechaMin, lte: fechaMax } },
      select: { fecha: true, monto: true, descripcion: true, referencia: true },
    })

    const existSet = new Set(
      existentes.map(e => `${e.fecha.toISOString().slice(0, 10)}|${e.monto}|${e.referencia || ''}|${e.descripcion}`)
    )

    const nuevos = rows.filter(r => {
      const key = `${r.fecha.toISOString().slice(0, 10)}|${r.monto}|${r.referencia || ''}|${r.descripcion}`
      return !existSet.has(key)
    })

    if (nuevos.length === 0) {
      return NextResponse.json({
        importados: 0,
        duplicados: rows.length,
        total: rows.length,
        formato,
        warnings,
        message: 'Todos los movimientos ya existen en el sistema',
      })
    }

    await prisma.movimientoBancario.createMany({
      data: nuevos.map(m => ({
        cuentaBancariaId,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: m.descripcion,
        referencia: m.referencia,
        conciliado: false,
      })),
    })

    return NextResponse.json({
      importados: nuevos.length,
      duplicados: rows.length - nuevos.length,
      total: rows.length,
      formato,
      warnings,
      message: `${nuevos.length} movimientos importados correctamente`,
    })
  } catch (error) {
    console.error('Error importing extracto:', error)
    const msg = error instanceof Error ? error.message : 'Error al importar'
    return NextResponse.json({ error: `Error al importar: ${msg}` }, { status: 500 })
  }
}
