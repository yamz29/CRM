import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rescheduleActividad, cascadeReschedule } from '@/lib/cronograma-scheduling'

type Params = { params: Promise<{ id: string; aid: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { aid } = await params
  const numId = parseInt(aid)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const {
    nombre, descripcion, duracion, fechaInicio, fechaFin,
    pctAvance, estado, dependenciaId, tipoDependencia, desfaseDias,
    orden, capituloNombre, cuadrilla, tipo, wbs,
  } = body

  // 1. Aplicar cambios del usuario
  await prisma.actividadCronograma.update({
    where: { id: numId },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(descripcion !== undefined && { descripcion }),
      ...(capituloNombre !== undefined && { capituloNombre }),
      ...(duracion !== undefined && { duracion: parseInt(duracion) }),
      ...(fechaInicio !== undefined && { fechaInicio: new Date(fechaInicio) }),
      ...(fechaFin !== undefined && { fechaFin: new Date(fechaFin) }),
      ...(pctAvance !== undefined && { pctAvance: parseFloat(pctAvance) }),
      ...(estado !== undefined && { estado }),
      ...(dependenciaId !== undefined && { dependenciaId: dependenciaId ? parseInt(dependenciaId) : null }),
      ...(tipoDependencia !== undefined && { tipoDependencia }),
      ...(desfaseDias !== undefined && { desfaseDias: parseInt(desfaseDias) || 0 }),
      ...(orden !== undefined && { orden: parseInt(orden) }),
      ...(cuadrilla !== undefined && { cuadrilla: cuadrilla || null }),
      ...(tipo !== undefined && { tipo }),
      ...(wbs !== undefined && { wbs: wbs || null }),
    },
  })

  // 2. Auto-recalcular fechas si cambió algo relevante al agendamiento
  //    (duracion, dependenciaId, tipoDependencia, desfaseDias o fechaInicio explícita)
  const schedulingFieldsChanged =
    duracion !== undefined ||
    dependenciaId !== undefined ||
    tipoDependencia !== undefined ||
    desfaseDias !== undefined ||
    fechaInicio !== undefined ||
    tipo !== undefined

  if (schedulingFieldsChanged) {
    await rescheduleActividad(numId)
    // 3. Propagar cambios en cascada a sucesoras
    await cascadeReschedule(numId)
  }

  // 4. Re-leer la actividad actualizada para devolverla
  const actividad = await prisma.actividadCronograma.findUnique({ where: { id: numId } })
  if (!actividad) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 })

  // 5. Auto-actualizar estado basado en avance
  let estadoCalculado = actividad.estado
  const hoy = new Date()
  if (actividad.pctAvance >= 100) {
    estadoCalculado = 'Completado'
  } else if (actividad.pctAvance > 0) {
    estadoCalculado = 'En Ejecución'
  } else if (new Date(actividad.fechaFin) < hoy) {
    estadoCalculado = 'Atrasado'
  }

  if (estadoCalculado !== actividad.estado) {
    await prisma.actividadCronograma.update({
      where: { id: numId },
      data: { estado: estadoCalculado },
    })
  }

  return NextResponse.json({ ...actividad, estado: estadoCalculado })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { aid } = await params
  const numId = parseInt(aid)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.actividadCronograma.delete({ where: { id: numId } })
  return NextResponse.json({ ok: true })
}
