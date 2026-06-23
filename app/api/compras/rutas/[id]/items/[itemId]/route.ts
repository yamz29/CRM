import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// PATCH /api/compras/rutas/[id]/items/[itemId]
// Endpoint ligero para el modo en vivo: marcar comprado / fijar precio real.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { itemId: itemIdStr } = await params
  const itemId = parseInt(itemIdStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.comprado !== undefined) data.comprado = Boolean(body.comprado)
    if (body.precioReal !== undefined) {
      data.precioReal = body.precioReal === null || body.precioReal === '' ? null : parseFloat(String(body.precioReal))
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const item = await prisma.itemRutaCompra.update({ where: { id: itemId }, data })
    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
