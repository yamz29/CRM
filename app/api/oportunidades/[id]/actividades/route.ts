import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const actividades = await prisma.actividadCRM.findMany({
    where: { oportunidadId: numId },
    orderBy: { fecha: 'desc' },
  })

  return NextResponse.json(actividades)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { tipo, descripcion, fecha } = body

  if (!tipo || !descripcion) {
    return NextResponse.json({ error: 'tipo y descripcion son requeridos' }, { status: 400 })
  }

  const actividad = await prisma.actividadCRM.create({
    data: {
      oportunidadId: numId,
      tipo,
      descripcion,
      fecha: fecha ? new Date(fecha) : new Date(),
    },
  })

  return NextResponse.json(actividad, { status: 201 })
}
