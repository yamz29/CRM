import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })
    if (!tarea) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(tarea)
  } catch (error) {
    console.error('Error fetching tarea:', error)
    return NextResponse.json({ error: 'Error al obtener tarea' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const { titulo, descripcion, clienteId, proyectoId, fechaLimite, prioridad, estado, responsable } = body

    if (!titulo?.trim()) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    const tarea = await prisma.tarea.update({
      where: { id },
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        clienteId: clienteId ? parseInt(String(clienteId)) : null,
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        prioridad: prioridad || 'Media',
        estado: estado || 'Pendiente',
        responsable: responsable || null,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(tarea)
  } catch (error) {
    console.error('Error updating tarea:', error)
    return NextResponse.json({ error: 'Error al actualizar tarea' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.tarea.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tarea:', error)
    return NextResponse.json({ error: 'Error al eliminar tarea' }, { status: 500 })
  }
}
