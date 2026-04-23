import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addWorkingDays } from '@/lib/calendario-laboral'
import { recalcularCriticalPath } from '@/lib/cronograma-scheduling'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Params) => {
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
})

export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const cronogramaId = parseInt(id)
  if (isNaN(cronogramaId)) {
    return NextResponse.json({ error: 'ID de cronograma inválido' }, { status: 400 })
  }

  const body = await req.json()

  const {
    nombre, descripcion, capituloNombre, partidaId,
    duracion, fechaInicio, fechaFin,
    pctAvance, estado, dependenciaId, tipoDependencia, desfaseDias, orden, tipo,
  } = body

  if (!nombre) {
    return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  }

  // Cargar cronograma para usar su fechaInicio como default y sus opts de calendario
  const cronograma = await prisma.cronograma.findUnique({
    where: { id: cronogramaId },
    select: { fechaInicio: true, usarCalendarioLaboral: true, usarFeriados: true },
  })
  if (!cronograma) {
    return NextResponse.json({ error: 'Cronograma no encontrado' }, { status: 404 })
  }

  // fechaInicio: usa la del body, o la del cronograma
  const inicio = fechaInicio ? new Date(fechaInicio) : new Date(cronograma.fechaInicio)

  // fechaFin: si no viene, calcula a partir de duracion
  const dur = duracion ?? 1
  let fin: Date
  if (fechaFin) {
    fin = new Date(fechaFin)
  } else {
    // Considerar calendario laboral del cronograma
    const usarLab = (cronograma as { usarCalendarioLaboral?: boolean }).usarCalendarioLaboral ?? true
    fin = addWorkingDays(inicio, Math.max(0, dur - 1), { usarCalendarioLaboral: usarLab })
  }

  const actividad = await prisma.actividadCronograma.create({
    data: {
      cronogramaId,
      nombre,
      tipo: tipo ?? 'tarea',
      descripcion: descripcion ?? null,
      capituloNombre: capituloNombre ?? null,
      partidaId: partidaId ? parseInt(partidaId) : null,
      duracion: dur,
      fechaInicio: inicio,
      fechaFin: fin,
      pctAvance: pctAvance ?? 0,
      estado: estado ?? 'Pendiente',
      dependenciaId: dependenciaId ? parseInt(dependenciaId) : null,
      tipoDependencia: tipoDependencia ?? 'FS',
      desfaseDias: desfaseDias ?? 0,
      orden: orden ?? 0,
    },
  })

  // Recalcular CPM del cronograma por si afecta la ruta crítica
  await recalcularCriticalPath(cronogramaId).catch(() => { /* no bloqueante */ })

  return NextResponse.json(actividad, { status: 201 })
})
