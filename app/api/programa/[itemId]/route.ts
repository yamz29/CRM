import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

const PRIORIDADES = ['Alta', 'Normal', 'Baja']
const ESTADOS = ['Pendiente', 'En Progreso', 'Completado', 'Cancelado']

// PATCH /api/programa/[itemId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { itemId: idStr } = await params
  const itemId = parseInt(idStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.descripcion !== undefined) {
      const d = body.descripcion?.toString().trim()
      if (!d) return NextResponse.json({ error: 'Descripción no puede estar vacía' }, { status: 400 })
      data.descripcion = d
    }
    if (body.cantidad !== undefined) data.cantidad = body.cantidad?.toString().trim() || null
    if (body.fechaObjetivo !== undefined) {
      data.fechaObjetivo = body.fechaObjetivo ? new Date(body.fechaObjetivo) : null
    }
    if (body.prioridad !== undefined && PRIORIDADES.includes(body.prioridad)) {
      data.prioridad = body.prioridad
    }
    if (body.estado !== undefined && ESTADOS.includes(body.estado)) {
      data.estado = body.estado
      // Timestamp de completado
      if (body.estado === 'Completado') {
        data.completedAt = new Date()
      } else if (body.estado === 'Pendiente' || body.estado === 'En Progreso') {
        data.completedAt = null
      }
    }
    if (body.notas !== undefined) data.notas = body.notas?.toString().trim() || null
    if (body.orden !== undefined && typeof body.orden === 'number') data.orden = body.orden

    const item = await prisma.itemProgramaProyecto.update({
      where: { id: itemId },
      data,
      include: {
        ordenCompra: { select: { id: true, numero: true, estado: true } },
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/programa/[itemId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { itemId: idStr } = await params
  const itemId = parseInt(idStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.itemProgramaProyecto.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
