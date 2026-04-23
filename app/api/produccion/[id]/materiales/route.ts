import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string }> }

export const GET = withPermiso('produccion', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params

  const materiales = await prisma.materialOrdenProduccion.findMany({
    where: { ordenId: parseInt(id) },
    include: { material: { select: { id: true, nombre: true, tipo: true } } },
    orderBy: { nombre: 'asc' },
  })

  return NextResponse.json(materiales)
})

export const PUT = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const { updates } = await req.json()

  // Bulk update materials
  try {
    await Promise.all(
      updates.map((u: { id: number; cantidadComprada?: number; cantidadRecibida?: number; estado?: string }) =>
        prisma.materialOrdenProduccion.update({
          where: { id: u.id, ordenId: parseInt(id) },
          data: {
            ...(u.cantidadComprada !== undefined && { cantidadComprada: u.cantidadComprada }),
            ...(u.cantidadRecibida !== undefined && { cantidadRecibida: u.cantidadRecibida }),
            ...(u.estado !== undefined && { estado: u.estado }),
          },
        })
      )
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar materiales' }, { status: 500 })
  }
})
