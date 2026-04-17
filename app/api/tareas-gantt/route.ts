import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('proyectos', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const proyectoId = searchParams.get('proyectoId')

  const where: Record<string, unknown> = {}
  if (proyectoId === 'null') where.proyectoId = null
  else if (proyectoId) where.proyectoId = parseInt(proyectoId)

  const tareas = await prisma.tareaGantt.findMany({
    where,
    include: { proyecto: { select: { id: true, nombre: true } } },
    orderBy: { fechaInicio: 'asc' },
  })

  return NextResponse.json(tareas)
})

export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest) => {
  const body = await req.json()
  const { nombre, fechaInicio, fechaFin, descripcion, color, avance, proyectoId } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  }
  if (!fechaInicio || !fechaFin) {
    return NextResponse.json({ error: 'Fechas de inicio y fin requeridas' }, { status: 400 })
  }
  const ini = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  if (fin < ini) {
    return NextResponse.json({ error: 'La fecha de fin debe ser posterior al inicio' }, { status: 400 })
  }

  const tarea = await prisma.tareaGantt.create({
    data: {
      nombre: nombre.trim(),
      fechaInicio: ini,
      fechaFin: fin,
      descripcion: descripcion?.trim() || null,
      color: color?.trim() || null,
      avance: typeof avance === 'number' ? Math.max(0, Math.min(100, avance)) : 0,
      proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
    },
    include: { proyecto: { select: { id: true, nombre: true } } },
  })

  return NextResponse.json(tarea, { status: 201 })
})
