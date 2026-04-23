import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const partidas = await prisma.proyectoPartida.findMany({
    where: { proyectoId },
    orderBy: [{ capitulo: { orden: 'asc' } }, { orden: 'asc' }],
    select: {
      id: true,
      descripcion: true,
      codigo: true,
      capituloNombre: true,
      subtotalPresupuestado: true,
      unidad: true,
    },
  })

  return NextResponse.json(partidas)
})
