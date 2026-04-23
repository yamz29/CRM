import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('proyectos', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const proyectoId = searchParams.get('proyectoId')
  const estado = searchParams.get('estado')

  const cronogramas = await prisma.cronograma.findMany({
    where: {
      ...(proyectoId ? { proyectoId: parseInt(proyectoId) } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      presupuesto: { select: { id: true, numero: true } },
      _count: { select: { actividades: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(cronogramas)
})

export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest) => {
  const body = await req.json()
  const { nombre, proyectoId, presupuestoId, fechaInicio, fechaFinEstimado, estado, notas } = body

  if (!nombre || !fechaInicio) {
    return NextResponse.json({ error: 'nombre y fechaInicio son requeridos' }, { status: 400 })
  }

  const cronograma = await prisma.cronograma.create({
    data: {
      nombre,
      proyectoId: proyectoId ? parseInt(proyectoId) : null,
      presupuestoId: presupuestoId ? parseInt(presupuestoId) : null,
      fechaInicio: new Date(fechaInicio),
      fechaFinEstimado: fechaFinEstimado ? new Date(fechaFinEstimado) : null,
      estado: estado || 'Planificado',
      notas,
    },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      presupuesto: { select: { id: true, numero: true } },
    },
  })

  return NextResponse.json(cronograma, { status: 201 })
})
