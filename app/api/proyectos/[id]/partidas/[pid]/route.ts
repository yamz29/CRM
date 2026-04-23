import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string; pid: string }> }

/**
 * PUT /api/proyectos/[id]/partidas/[pid]
 * Edita campos individuales de una partida: codigo, descripcion, unidad,
 * cantidad, precioUnitario (se recalcula subtotal).
 */
export const PUT = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id, pid } = await params
  const proyectoId = parseInt(id)
  const partidaId = parseInt(pid)
  if (isNaN(proyectoId) || isNaN(partidaId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Validar que la partida pertenece al proyecto
  const existente = await prisma.proyectoPartida.findFirst({
    where: { id: partidaId, proyectoId },
  })
  if (!existente) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 })

  const body = await req.json()
  const { codigo, descripcion, unidad, cantidad, precioUnitario, observaciones } = body

  const data: Record<string, unknown> = {}
  if (codigo !== undefined) data.codigo = codigo?.trim() || null
  if (descripcion !== undefined) {
    if (!String(descripcion).trim()) {
      return NextResponse.json({ error: 'La descripción no puede estar vacía' }, { status: 400 })
    }
    data.descripcion = String(descripcion).trim()
  }
  if (unidad !== undefined) data.unidad = unidad?.trim() || 'gl'
  if (cantidad !== undefined) data.cantidad = parseFloat(String(cantidad)) || 0
  if (precioUnitario !== undefined) data.precioUnitario = parseFloat(String(precioUnitario)) || 0
  if (observaciones !== undefined) data.observaciones = observaciones?.trim() || null

  // Recalcular subtotal si cambió cantidad o precio
  if (cantidad !== undefined || precioUnitario !== undefined) {
    const newCantidad = cantidad !== undefined ? (data.cantidad as number) : existente.cantidad
    const newPrecio = precioUnitario !== undefined ? (data.precioUnitario as number) : existente.precioUnitario
    data.subtotalPresupuestado = newCantidad * newPrecio
  }

  const partida = await prisma.proyectoPartida.update({
    where: { id: partidaId },
    data,
  })

  return NextResponse.json(partida)
})

/**
 * DELETE /api/proyectos/[id]/partidas/[pid]
 * Elimina la partida. Los gastos asociados quedan con partidaId = null (SetNull).
 */
export const DELETE = withPermiso('proyectos', 'editar', async (_req: NextRequest, { params }: Params) => {
  const { id, pid } = await params
  const proyectoId = parseInt(id)
  const partidaId = parseInt(pid)
  if (isNaN(proyectoId) || isNaN(partidaId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const existente = await prisma.proyectoPartida.findFirst({
    where: { id: partidaId, proyectoId },
  })
  if (!existente) return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 })

  await prisma.proyectoPartida.delete({ where: { id: partidaId } })
  return NextResponse.json({ ok: true })
})
