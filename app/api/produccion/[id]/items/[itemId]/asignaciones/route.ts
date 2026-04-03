import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; itemId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { itemId } = await params

  const asignaciones = await prisma.asignacionProduccion.findMany({
    where: { itemId: parseInt(itemId), activo: true },
    include: { usuario: { select: { id: true, nombre: true, correo: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(asignaciones)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const { usuarioId, etapa } = await req.json()

  try {
    const asignacion = await prisma.asignacionProduccion.upsert({
      where: {
        itemId_usuarioId_etapa: {
          itemId: parseInt(itemId),
          usuarioId: parseInt(usuarioId),
          etapa,
        },
      },
      update: { activo: true },
      create: {
        itemId: parseInt(itemId),
        usuarioId: parseInt(usuarioId),
        etapa,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json(asignacion, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al asignar' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  const { usuarioId, etapa } = await req.json()

  try {
    await prisma.asignacionProduccion.delete({
      where: {
        itemId_usuarioId_etapa: {
          itemId: parseInt(itemId),
          usuarioId: parseInt(usuarioId),
          etapa,
        },
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al desasignar' }, { status: 500 })
  }
}
