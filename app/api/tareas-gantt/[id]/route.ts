import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

export const PUT = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const tareaId = parseInt(id)
  if (isNaN(tareaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.nombre !== undefined) data.nombre = String(body.nombre).trim()
  if (body.fechaInicio !== undefined) data.fechaInicio = new Date(body.fechaInicio)
  if (body.fechaFin !== undefined) data.fechaFin = new Date(body.fechaFin)
  if (body.descripcion !== undefined) data.descripcion = body.descripcion?.trim() || null
  if (body.color !== undefined) data.color = body.color?.trim() || null
  if (body.avance !== undefined) data.avance = Math.max(0, Math.min(100, parseInt(String(body.avance)) || 0))
  if (body.proyectoId !== undefined) {
    data.proyectoId = body.proyectoId ? parseInt(String(body.proyectoId)) : null
  }

  const tarea = await prisma.tareaGantt.update({
    where: { id: tareaId },
    data,
    include: { proyecto: { select: { id: true, nombre: true } } },
  })

  return NextResponse.json(tarea)
})

export const DELETE = withPermiso('proyectos', 'editar', async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const tareaId = parseInt(id)
  if (isNaN(tareaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.tareaGantt.delete({ where: { id: tareaId } })
  return NextResponse.json({ ok: true })
})
