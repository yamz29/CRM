import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string; itemId: string }> }

export const GET = withPermiso('produccion', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params

  const asignaciones = await prisma.asignacionProduccion.findMany({
    where: { ordenId: parseInt(id), activo: true },
    include: { usuario: { select: { id: true, nombre: true, correo: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(asignaciones)
})

export const POST = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const { usuarioId, etapa } = await req.json()

  try {
    // Check if already assigned
    const existing = await prisma.asignacionProduccion.findFirst({
      where: {
        ordenId: parseInt(id),
        usuarioId: parseInt(usuarioId),
        etapa,
        activo: true,
      },
    })

    if (existing) {
      return NextResponse.json(existing, { status: 200 })
    }

    const asignacion = await prisma.asignacionProduccion.create({
      data: {
        ordenId: parseInt(id),
        usuarioId: parseInt(usuarioId),
        etapa,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json(asignacion, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al asignar' }, { status: 500 })
  }
})

export const DELETE = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const { usuarioId, etapa } = await req.json()

  try {
    await prisma.asignacionProduccion.deleteMany({
      where: {
        ordenId: parseInt(id),
        usuarioId: parseInt(usuarioId),
        etapa,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al desasignar' }, { status: 500 })
  }
})
