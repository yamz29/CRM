import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; aid: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { aid } = await params
  const numId = parseInt(aid)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const {
    nombre, descripcion, duracion, fechaInicio, fechaFin,
    pctAvance, estado, dependenciaId, tipoDependencia, orden, capituloNombre, cuadrilla, tipo, wbs,
  } = body

  const actividad = await prisma.actividadCronograma.update({
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
      ...(orden !== undefined && { orden: parseInt(orden) }),
      ...(cuadrilla !== undefined && { cuadrilla: cuadrilla || null }),
      ...(tipo !== undefined && { tipo }),
      ...(wbs !== undefined && { wbs: wbs || null }),
    },
  })

  // Auto-actualizar estado basado en avance
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
