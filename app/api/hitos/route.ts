import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

// GET /api/hitos — lista todos los hitos (globales + de cualquier proyecto)
export const GET = withPermiso('proyectos', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const proyectoId = searchParams.get('proyectoId')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const where: Record<string, unknown> = {}
  if (proyectoId === 'null') where.proyectoId = null
  else if (proyectoId) where.proyectoId = parseInt(proyectoId)
  if (desde || hasta) {
    where.fecha = {}
    if (desde) (where.fecha as Record<string, unknown>).gte = new Date(desde)
    if (hasta) (where.fecha as Record<string, unknown>).lte = new Date(hasta + 'T23:59:59')
  }

  const hitos = await prisma.hitoCronograma.findMany({
    where,
    include: { proyecto: { select: { id: true, nombre: true } } },
    orderBy: { fecha: 'asc' },
  })

  return NextResponse.json(hitos)
})

// POST /api/hitos — crear nuevo hito
export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest) => {
  const body = await req.json()
  const { nombre, fecha, descripcion, color, icono, proyectoId } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }
  if (!fecha) {
    return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })
  }

  const hito = await prisma.hitoCronograma.create({
    data: {
      nombre: nombre.trim(),
      fecha: new Date(fecha),
      descripcion: descripcion?.trim() || null,
      color: color?.trim() || null,
      icono: icono?.trim() || null,
      proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
    },
    include: { proyecto: { select: { id: true, nombre: true } } },
  })

  return NextResponse.json(hito, { status: 201 })
})
