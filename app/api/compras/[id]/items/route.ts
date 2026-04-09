import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// POST /api/compras/[id]/items — agregar línea a la OC
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id } = await params
  const ordenCompraId = parseInt(id)
  if (isNaN(ordenCompraId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const descripcion = body.descripcion?.toString().trim()
    if (!descripcion) return NextResponse.json({ error: 'Descripción es obligatoria' }, { status: 400 })

    const cantidad = parseFloat(body.cantidad) || 1
    const precioUnitario = parseFloat(body.precioUnitario) || 0
    const subtotal = cantidad * precioUnitario

    const item = await prisma.itemOrdenCompra.create({
      data: {
        ordenCompraId,
        descripcion,
        unidad: body.unidad?.toString().trim() || 'ud',
        cantidad,
        precioUnitario,
        subtotal,
        observaciones: body.observaciones?.toString().trim() || null,
      },
    })

    // Recalcular totales de la orden
    await recalcularTotales(ordenCompraId)

    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function recalcularTotales(ordenCompraId: number) {
  const items = await prisma.itemOrdenCompra.findMany({ where: { ordenCompraId } })
  const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
  const orden = await prisma.ordenCompra.findUnique({ where: { id: ordenCompraId }, select: { impuesto: true } })
  await prisma.ordenCompra.update({
    where: { id: ordenCompraId },
    data: { subtotal, total: subtotal + (orden?.impuesto ?? 0) },
  })
}
