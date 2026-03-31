import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const cronogramaId = parseInt(id)

  const actividades = await prisma.actividadCronograma.findMany({
    where: { cronogramaId },
    include: {
      avances: { orderBy: { fecha: 'desc' }, take: 1 },
      dependencia: { select: { id: true, nombre: true } },
    },
    orderBy: [{ orden: 'asc' }, { fechaInicio: 'asc' }],
  })

  return NextResponse.json(actividades)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const cronogramaId = parseInt(id)
  const body = await req.json()

  const {
    nombre, descripcion, capituloNombre, partidaId,
    duracion, fechaInicio, fechaFin,
    pctAvance, estado, dependenciaId, tipoDependencia, orden,
  } = body

  if (!nombre || !fechaInicio || !fechaFin) {
    return NextResponse.json({ error: 'nombre, fechaInicio y fechaFin son requeridos' }, { status: 400 })
  }

  const actividad = await prisma.actividadCronograma.create({
    data: {
      cronogramaId,
      nombre,
      descripcion,
      capituloNombre,
      partidaId: partidaId ? parseInt(partidaId) : null,
      duracion: duracion ?? 1,
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      pctAvance: pctAvance ?? 0,
      estado: estado ?? 'Pendiente',
      dependenciaId: dependenciaId ? parseInt(dependenciaId) : null,
      tipoDependencia: tipoDependencia ?? 'FS',
      orden: orden ?? 0,
    },
  })

  return NextResponse.json(actividad, { status: 201 })
}
