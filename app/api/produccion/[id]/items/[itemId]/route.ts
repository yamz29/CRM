import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string; itemId: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
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
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { itemId } = await params

  try {
    await prisma.itemProduccion.delete({ where: { id: parseInt(itemId) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar item' }, { status: 500 })
  }
}
