import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: parseInt(id) },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      items: {
        include: {
          asignaciones: {
            where: { activo: true },
            include: { usuario: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      materiales: {
        include: { material: { select: { id: true, nombre: true, tipo: true } } },
        orderBy: { nombre: 'asc' },
      },
    },
  })

  if (!orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  return NextResponse.json(orden)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  try {
    const orden = await prisma.ordenProduccion.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.prioridad !== undefined && { prioridad: body.prioridad }),
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.fechaInicio !== undefined && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
        ...(body.fechaEstimada !== undefined && { fechaEstimada: body.fechaEstimada ? new Date(body.fechaEstimada) : null }),
        ...(body.notas !== undefined && { notas: body.notas }),
        ...(body.proyectoId !== undefined && { proyectoId: body.proyectoId ? parseInt(body.proyectoId) : null }),
        ...(body.estado === 'Completada' && { fechaCompletada: new Date() }),
      },
    })

    return NextResponse.json(orden)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar orden' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    await prisma.ordenProduccion.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar orden' }, { status: 500 })
  }
}
