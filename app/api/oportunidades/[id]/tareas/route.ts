import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: list tasks for this opportunity
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const tareas = await prisma.tarea.findMany({
    where: { oportunidadId: numId, archivada: false },
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      etapaPipeline: true,
      fechaLimite: true,
    },
    orderBy: [{ estado: 'asc' }, { prioridad: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(tareas)
}

// POST: create a quick task linked to this opportunity
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id: numId },
    select: { clienteId: true, etapa: true, responsable: true },
  })
  if (!oportunidad) return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })

  const body = await req.json()
  const { titulo, descripcion, prioridad } = body

  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'Título requerido' }, { status: 400 })
  }

  const tarea = await prisma.tarea.create({
    data: {
      titulo: titulo.trim(),
      descripcion: descripcion || null,
      prioridad: prioridad || 'Media',
      oportunidadId: numId,
      clienteId: oportunidad.clienteId,
      etapaPipeline: oportunidad.etapa,
      responsable: oportunidad.responsable || null,
    },
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      etapaPipeline: true,
      fechaLimite: true,
    },
  })

  return NextResponse.json(tarea, { status: 201 })
}
