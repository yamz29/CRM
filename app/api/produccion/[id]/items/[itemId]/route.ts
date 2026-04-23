import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string; itemId: string }> }

export const PUT = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { itemId } = await params
  const body = await req.json()

  try {
    const updated = await prisma.itemProduccion.update({
      where: { id: parseInt(itemId) },
      data: {
        ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
        ...(body.nombreModulo !== undefined && { nombreModulo: body.nombreModulo }),
        ...(body.completado !== undefined && { completado: body.completado }),
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

export const DELETE = withPermiso('produccion', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  const { itemId } = await params

  try {
    await prisma.itemProduccion.delete({ where: { id: parseInt(itemId) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar item' }, { status: 500 })
  }
})
