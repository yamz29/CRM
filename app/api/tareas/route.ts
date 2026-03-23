import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const tareas = await prisma.tarea.findMany({
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
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
    const { titulo, descripcion, clienteId, proyectoId, asignadoId, fechaLimite, prioridad, estado, responsable } = body

    if (!titulo?.trim()) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 })
    }

    const tarea = await prisma.tarea.create({
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        clienteId: clienteId ? parseInt(String(clienteId)) : null,
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        asignadoId: asignadoId ? parseInt(String(asignadoId)) : null,
        fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
        prioridad: prioridad || 'Media',
        estado: estado || 'Pendiente',
        responsable: responsable || null,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        asignado: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(tarea, { status: 201 })
  } catch (error) {
    console.error('Error creating tarea:', error)
    return NextResponse.json({ error: 'Error al crear tarea' }, { status: 500 })
  }
}
