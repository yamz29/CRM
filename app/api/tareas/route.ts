import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Auto-archive: completadas hace más de 7 días sin cambios
    const sieteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    await prisma.tarea.updateMany({
      where: {
        estado: 'Completada',
        archivada: false,
        fechaCompletada: { lt: sieteDiasAtras },
      },
      data: { archivada: true, fechaArchivada: new Date() },
    })

    // Auto-delete: archivadas hace más de 6 meses
    const seisMesesAtras = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    await prisma.tarea.deleteMany({
      where: {
        archivada: true,
        fechaArchivada: { lt: seisMesesAtras },
      },
    })

    const tareas = await prisma.tarea.findMany({
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        oportunidad: { select: { id: true, nombre: true, etapa: true } },
        asignado: { select: { id: true, nombre: true } },
      },
      orderBy: [{ prioridad: 'asc' }, { fechaLimite: 'asc' }],
    })
    return NextResponse.json(tareas)
  } catch (error) {
    console.error('Error fetching tareas:', error)
    return NextResponse.json({ error: 'Error al obtener tareas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { titulo, descripcion, clienteId, proyectoId, oportunidadId, asignadoId, fechaLimite, prioridad, estado, avance, responsable } = body

    if (!titulo?.trim()) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    const tarea = await prisma.tarea.create({
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        clienteId: clienteId ? parseInt(String(clienteId)) : null,
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        oportunidadId: oportunidadId ? parseInt(String(oportunidadId)) : null,
        asignadoId: asignadoId ? parseInt(String(asignadoId)) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        prioridad: prioridad || 'Media',
        estado: estado || 'Pendiente',
        avance: Math.min(100, Math.max(0, parseInt(String(avance ?? 0)) || 0)),
        responsable: responsable || null,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        oportunidad: { select: { id: true, nombre: true, etapa: true } },
        asignado: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(tarea, { status: 201 })
  } catch (error) {
    console.error('Error creating tarea:', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
