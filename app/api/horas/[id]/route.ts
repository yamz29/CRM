import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { usuarioId, fecha, horas, tipoActividad, proyectoId, nota, horaInicio } = body

    const registro = await prisma.registroHoras.update({
      where: { id: parseInt(id) },
      data: {
        usuarioId:     usuarioId != null ? parseInt(String(usuarioId)) : null,
        fecha:         fecha ? new Date(fecha) : undefined,
        horas:         horas  ? Math.max(0.25, parseFloat(String(horas))) : undefined,
        tipoActividad: tipoActividad || undefined,
        proyectoId:    tipoActividad === 'Proyecto' && proyectoId
                         ? parseInt(String(proyectoId)) : null,
        nota:          nota !== undefined ? (nota?.trim() || null) : undefined,
        horaInicio:    horaInicio !== undefined
                         ? (horaInicio != null ? parseFloat(String(horaInicio)) : null)
                         : undefined,
      },
      include: {
        usuario:  { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(registro)
  } catch (error) {
    console.error('Error updating registro de horas:', error)
    return NextResponse.json({ error: 'Error al actualizar registro' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.registroHoras.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting registro de horas:', error)
    return NextResponse.json({ error: 'Error al eliminar registro' }, { status: 500 })
  }
}
