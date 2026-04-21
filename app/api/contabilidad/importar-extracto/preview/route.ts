import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { parseExtracto } from '@/lib/parse-extracto'

// POST /api/contabilidad/importar-extracto/preview
// Parsea el archivo SIN persistir. Retorna muestras y conteo de duplicados
// para que el usuario revise antes de confirmar la importación.
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null
    const cuentaId = formData.get('cuentaId') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 400 })
    }
    if (!cuentaId) {
      return NextResponse.json({ error: 'Seleccione una cuenta bancaria' }, { status: 400 })
    }

    const cuentaBancariaId = parseInt(cuentaId)
    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: cuentaBancariaId } })
    if (!cuenta) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    }

    const result = await parseExtracto(file)

    if (result.rows.length === 0) {
      return NextResponse.json({
        formato: result.formato,
        total: 0,
        nuevos: 0,
        duplicados: 0,
        muestra: [],
        warnings: result.warnings.length > 0 ? result.warnings : ['No se encontraron movimientos en el archivo'],
      })
    }

    // Detectar duplicados (misma lógica que el endpoint de import)
    const fechaMin = new Date(Math.min(...result.rows.map(r => r.fecha.getTime())))
    const fechaMax = new Date(Math.max(...result.rows.map(r => r.fecha.getTime())))
    fechaMax.setHours(23, 59, 59)

    const existentes = await prisma.movimientoBancario.findMany({
      where: {
        cuentaBancariaId,
        fecha: { gte: fechaMin, lte: fechaMax },
      },
      select: { fecha: true, monto: true, descripcion: true, referencia: true },
    })

    const existSet = new Set(
      existentes.map(e => `${e.fecha.toISOString().slice(0, 10)}|${e.monto}|${e.referencia || ''}|${e.descripcion}`)
    )

    const rowsConDup = result.rows.map(r => ({
      ...r,
      fecha: r.fecha.toISOString(),
      duplicado: existSet.has(`${r.fecha.toISOString().slice(0, 10)}|${r.monto}|${r.referencia || ''}|${r.descripcion}`),
    }))

    const nuevos = rowsConDup.filter(r => !r.duplicado).length
    const duplicados = rowsConDup.length - nuevos

    // Totales para mostrar en la UI
    const totalCreditos = rowsConDup.filter(r => r.tipo === 'credito' && !r.duplicado).reduce((s, r) => s + r.monto, 0)
    const totalDebitos = rowsConDup.filter(r => r.tipo === 'debito' && !r.duplicado).reduce((s, r) => s + r.monto, 0)

    return NextResponse.json({
      formato: result.formato,
      total: rowsConDup.length,
      nuevos,
      duplicados,
      totalCreditos,
      totalDebitos,
      muestra: rowsConDup.slice(0, 20), // primeros 20 para preview
      todos: rowsConDup, // todas para que el cliente pueda enviarlas de vuelta a import
      warnings: result.warnings,
    })
  } catch (error) {
    console.error('Error preview extracto:', error)
    const msg = error instanceof Error ? error.message : 'Error al procesar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
