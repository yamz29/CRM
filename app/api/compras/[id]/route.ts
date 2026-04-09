import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/compras/[id] — detalle de orden
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'ver')
  if (denied) return denied

  const { id } = await params
  const ordenId = parseInt(id)
  if (isNaN(ordenId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const orden = await prisma.ordenCompra.findUnique({
    where: { id: ordenId },
    include: {
      proveedor: { select: { id: true, nombre: true, rnc: true, condicionesPago: true } },
      proyecto: { select: { id: true, nombre: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  return NextResponse.json(orden)
}

// PUT /api/compras/[id] — actualizar orden
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id } = await params
  const ordenId = parseInt(id)
  if (isNaN(ordenId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.proveedorId !== undefined) data.proveedorId = body.proveedorId ? parseInt(body.proveedorId) : null
    if (body.proyectoId !== undefined) data.proyectoId = body.proyectoId ? parseInt(body.proyectoId) : null
    if (body.fechaEntrega !== undefined) data.fechaEntrega = body.fechaEntrega ? new Date(body.fechaEntrega) : null
    if (body.fechaRecepcion !== undefined) data.fechaRecepcion = body.fechaRecepcion ? new Date(body.fechaRecepcion) : null
    if (body.condicionesPago !== undefined) data.condicionesPago = body.condicionesPago?.toString().trim() || null
    if (body.moneda !== undefined) data.moneda = body.moneda
    if (body.notas !== undefined) data.notas = body.notas?.toString().trim() || null

    if (body.estado !== undefined) {
      const estadosValidos = ['borrador', 'enviada', 'recibida_parcial', 'recibida', 'facturada', 'cancelada']
      if (!estadosValidos.includes(body.estado)) {
        return NextResponse.json({ error: `Estado inválido. Use: ${estadosValidos.join(', ')}` }, { status: 400 })
      }
      data.estado = body.estado
      if (body.estado === 'recibida') data.fechaRecepcion = new Date()
    }

    // Recalcular totales si se indica
    if (body._recalcular) {
      const items = await prisma.itemOrdenCompra.findMany({ where: { ordenCompraId: ordenId } })
      const subtotal = items.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)
      const impuesto = body.impuesto !== undefined ? parseFloat(body.impuesto) : undefined
      data.subtotal = subtotal
      if (impuesto !== undefined) {
        data.impuesto = impuesto
        data.total = subtotal + impuesto
      } else {
        // Mantener impuesto actual
        const current = await prisma.ordenCompra.findUnique({ where: { id: ordenId }, select: { impuesto: true } })
        data.total = subtotal + (current?.impuesto ?? 0)
      }
    }

    const orden = await prisma.ordenCompra.update({
      where: { id: ordenId },
      data,
      include: {
        proveedor: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    })

    return NextResponse.json(orden)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/compras/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'admin')
  if (denied) return denied

  const { id } = await params
  const ordenId = parseInt(id)
  if (isNaN(ordenId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // Solo borrador se puede eliminar
  const orden = await prisma.ordenCompra.findUnique({ where: { id: ordenId }, select: { estado: true } })
  if (!orden) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (orden.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden eliminar órdenes en borrador' }, { status: 400 })
  }

  await prisma.ordenCompra.delete({ where: { id: ordenId } })
  return NextResponse.json({ ok: true })
}
