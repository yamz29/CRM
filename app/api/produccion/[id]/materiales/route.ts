import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const materiales = await prisma.materialOrdenProduccion.findMany({
    where: { ordenId: parseInt(id) },
    include: { material: { select: { id: true, nombre: true, tipo: true } } },
    orderBy: { nombre: 'asc' },
  })

  return NextResponse.json(materiales)
}

export async function PUT(req: NextRequest, { params }: Params) {
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
}
