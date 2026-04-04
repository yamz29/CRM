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
        asignado: { select: { id: true, nombre: true } },
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
    const { titulo, descripcion, clienteId, proyectoId, oportunidadId, asignadoId, fechaLimite, prioridad, estado, avance, responsable, _patch, _archivar } = body

    const tareaIncludes = {
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
      oportunidad: { select: { id: true, nombre: true, etapa: true } },
      asignado: { select: { id: true, nombre: true } },
    } as const

    // Archivar / desarchivar
    if (typeof _archivar === 'boolean') {
      const tarea = await prisma.tarea.update({
        where: { id },
        data: {
          archivada: _archivar,
          fechaArchivada: _archivar ? new Date() : null,
        },
        include: tareaIncludes,
      })
      return NextResponse.json(tarea)
    }

    // Patch mode: only update estado (used by Kanban drag & drop)
    if (_patch) {
      // Track fechaCompletada
      const patchData: any = { estado }
      if (estado === 'Completada') {
        patchData.fechaCompletada = new Date()
      } else {
        patchData.fechaCompletada = null
      }
      const tarea = await prisma.tarea.update({
        where: { id },
        data: patchData,
        include: tareaIncludes,
      })
      return NextResponse.json(tarea)
    }

    if (!titulo?.trim()) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    // Track fechaCompletada on full update
    const current = await prisma.tarea.findUnique({ where: { id }, select: { estado: true } })
    const nuevoEstado = estado || 'Pendiente'
    let fechaCompletada: Date | null | undefined = undefined
    if (nuevoEstado === 'Completada' && current?.estado !== 'Completada') {
      fechaCompletada = new Date()
    } else if (nuevoEstado !== 'Completada') {
      fechaCompletada = null
    }

    const tarea = await prisma.tarea.update({
      where: { id },
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        clienteId: clienteId ? parseInt(String(clienteId)) : null,
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        oportunidadId: oportunidadId ? parseInt(String(oportunidadId)) : null,
        asignadoId: asignadoId ? parseInt(String(asignadoId)) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        prioridad: prioridad || 'Media',
        estado: nuevoEstado,
        avance: Math.min(100, Math.max(0, parseInt(String(avance ?? 0)) || 0)),
        responsable: responsable || null,
        ...(fechaCompletada !== undefined ? { fechaCompletada } : {}),
      },
      include: tareaIncludes,
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
