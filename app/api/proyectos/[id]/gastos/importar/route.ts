import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

interface RowInput {
  fecha?: string
  tipoGasto?: string
  tipo_gasto?: string
  referencia?: string
  descripcion?: string
  suplidor?: string
  categoria?: string
  subcategoria?: string
  monto?: string | number
  moneda?: string
  metodoPago?: string
  metodo_pago?: string
  cuentaOrigen?: string
  cuenta_origen?: string
  observaciones?: string
  estado?: string
}

const TIPOS_VALIDOS = ['Factura', 'Gasto menor', 'Transferencia', 'Caja chica', 'Compra de materiales', 'Mano de obra', 'Transporte', 'Subcontrato', 'Servicio', 'Otro']
const METODOS_VALIDOS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Caja chica', 'Otro']
const ESTADOS_VALIDOS = ['Registrado', 'Revisado', 'Anulado']

export const POST = withPermiso('gastos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // Verify project exists
  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId }, select: { id: true } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const body = await req.json() as { rows: RowInput[] }
  const rows = body.rows ?? []

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
  }

  const errores: { fila: number; error: string }[] = []
  const validas: typeof rows = []

  rows.forEach((row, i) => {
    const fila = i + 2 // 1-indexed + header
    const tipoGasto = row.tipoGasto || row.tipo_gasto || 'Gasto menor'
    const metodoPago = row.metodoPago || row.metodo_pago || 'Efectivo'
    const estado = row.estado || 'Registrado'

    if (!row.descripcion?.trim()) { errores.push({ fila, error: 'Descripción requerida' }); return }
    if (!row.fecha) { errores.push({ fila, error: 'Fecha requerida' }); return }
    if (isNaN(new Date(row.fecha).getTime())) { errores.push({ fila, error: 'Fecha inválida' }); return }
    const monto = parseFloat(String(row.monto ?? '0'))
    if (isNaN(monto) || monto < 0) { errores.push({ fila, error: 'Monto inválido' }); return }
    if (!TIPOS_VALIDOS.includes(tipoGasto)) { errores.push({ fila, error: `Tipo de gasto inválido: ${tipoGasto}` }); return }
    if (!METODOS_VALIDOS.includes(metodoPago)) { errores.push({ fila, error: `Método de pago inválido: ${metodoPago}` }); return }
    if (!ESTADOS_VALIDOS.includes(estado)) { errores.push({ fila, error: `Estado inválido: ${estado}` }); return }

    validas.push(row)
  })

  if (validas.length === 0) {
    return NextResponse.json({ importados: 0, errores })
  }

  await prisma.gastoProyecto.createMany({
    data: validas.map((row) => ({
      proyectoId,
      fecha: new Date(row.fecha!),
      tipoGasto: row.tipoGasto || row.tipo_gasto || 'Gasto menor',
      referencia: row.referencia?.trim() || null,
      descripcion: row.descripcion!.trim(),
      suplidor: row.suplidor?.trim() || null,
      categoria: row.categoria?.trim() || null,
      subcategoria: row.subcategoria?.trim() || null,
      monto: Math.max(0, parseFloat(String(row.monto ?? '0'))),
      moneda: row.moneda || 'RD$',
      metodoPago: row.metodoPago || row.metodo_pago || 'Efectivo',
      cuentaOrigen: (row.cuentaOrigen || row.cuenta_origen)?.trim() || null,
      observaciones: row.observaciones?.trim() || null,
      estado: row.estado || 'Registrado',
    })),
  })

  return NextResponse.json({ importados: validas.length, errores })
})
