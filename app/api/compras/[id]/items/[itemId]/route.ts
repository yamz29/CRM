import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// PUT /api/compras/[id]/items/[itemId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id, itemId: itemIdStr } = await params
  const ordenCompraId = parseInt(id)
  const itemId = parseInt(itemIdStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.descripcion !== undefined) {
      const desc = body.descripcion?.toString().trim()
      if (!desc) return NextResponse.json({ error: 'Descripción es obligatoria' }, { status: 400 })
      data.descripcion = desc
    }
    if (body.unidad !== undefined) data.unidad = body.unidad?.toString().trim() || 'ud'
    if (body.observaciones !== undefined) data.observaciones = body.observaciones?.toString().trim() || null
    if (body.cantidadRecibida !== undefined) data.cantidadRecibida = parseFloat(body.cantidadRecibida) || 0

    // Recalcular subtotal si cantidad o precio cambiaron
    if (body.cantidad !== undefined || body.precioUnitario !== undefined) {
      const current = await prisma.itemOrdenCompra.findUnique({ where: { id: itemId } })
      if (!current) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })

      const cantidad = body.cantidad !== undefined ? parseFloat(body.cantidad) || 0 : current.cantidad
      const precioUnitario = body.precioUnitario !== undefined ? parseFloat(body.precioUnitario) || 0 : current.precioUnitario
      data.cantidad = cantidad
      data.precioUnitario = precioUnitario
      data.subtotal = cantidad * precioUnitario
    }

    const item = await prisma.itemOrdenCompra.update({ where: { id: itemId }, data })

    // Recalcular totales de la orden
    const items = await prisma.itemOrdenCompra.findMany({ where: { ordenCompraId } })
    const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
    const orden = await prisma.ordenCompra.findUnique({ where: { id: ordenCompraId }, select: { impuesto: true } })
    await prisma.ordenCompra.update({
      where: { id: ordenCompraId },
      data: { subtotal, total: subtotal + (orden?.impuesto ?? 0) },
    })

    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/compras/[id]/items/[itemId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id, itemId: itemIdStr } = await params
  const ordenCompraId = parseInt(id)
  const itemId = parseInt(itemIdStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.itemOrdenCompra.delete({ where: { id: itemId } })

  // Recalcular totales
  const items = await prisma.itemOrdenCompra.findMany({ where: { ordenCompraId } })
  const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
  const orden = await prisma.ordenCompra.findUnique({ where: { id: ordenCompraId }, select: { impuesto: true } })
  await prisma.ordenCompra.update({
    where: { id: ordenCompraId },
    data: { subtotal, total: subtotal + (orden?.impuesto ?? 0) },
  })

  return NextResponse.json({ ok: true })
}
