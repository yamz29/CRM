import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

export const PUT = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const hitoId = parseInt(id)
  if (isNaN(hitoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.nombre !== undefined) data.nombre = String(body.nombre).trim()
  if (body.fecha !== undefined) data.fecha = new Date(body.fecha)
  if (body.descripcion !== undefined) data.descripcion = body.descripcion?.trim() || null
  if (body.color !== undefined) data.color = body.color?.trim() || null
  if (body.icono !== undefined) data.icono = body.icono?.trim() || null
  if (body.proyectoId !== undefined) {
    data.proyectoId = body.proyectoId ? parseInt(String(body.proyectoId)) : null
  }

  const hito = await prisma.hitoCronograma.update({
    where: { id: hitoId },
    data,
    include: { proyecto: { select: { id: true, nombre: true } } },
  })

  return NextResponse.json(hito)
})

export const DELETE = withPermiso('proyectos', 'editar', async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const hitoId = parseInt(id)
  if (isNaN(hitoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.hitoCronograma.delete({ where: { id: hitoId } })
  return NextResponse.json({ ok: true })
})
