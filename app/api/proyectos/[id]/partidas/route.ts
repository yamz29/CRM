import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
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
}
