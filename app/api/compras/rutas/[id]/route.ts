import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/compras/rutas/[id] — detalle con items, proveedor y proyecto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'ver')
  if (denied) return denied

  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const ruta = await prisma.rutaCompra.findUnique({
    where: { id: rutaId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: {
          proveedor: { select: { id: true, nombre: true, direccion: true, telefono: true } },
          proyecto: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  if (!ruta) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(ruta)
}

// PUT /api/compras/rutas/[id] — actualizar cabecera + reemplazar items
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []

    // Reemplazo total de líneas dentro de una transacción
    await prisma.$transaction([
      prisma.rutaCompra.update({
        where: { id: rutaId },
        data: {
          titulo: body.titulo !== undefined ? (body.titulo?.toString().trim() || null) : undefined,
          comprador: body.comprador !== undefined ? (body.comprador?.toString().trim() || null) : undefined,
          fecha: body.fecha ? new Date(body.fecha) : undefined,
          estado: ['borrador', 'en_proceso', 'completada', 'cancelada'].includes(body.estado) ? body.estado : undefined,
          notas: body.notas !== undefined ? (body.notas?.toString().trim() || null) : undefined,
        },
      }),
      prisma.itemRutaCompra.deleteMany({ where: { rutaCompraId: rutaId } }),
      prisma.itemRutaCompra.createMany({
        data: items.map((it: Record<string, unknown>, idx: number) => ({
          rutaCompraId: rutaId,
          descripcion: String(it.descripcion ?? '').trim() || 'Material',
          cantidad: parseFloat(String(it.cantidad)) || 1,
          unidad: String(it.unidad ?? 'ud').trim() || 'ud',
          proyectoId: it.proyectoId ? parseInt(String(it.proyectoId)) : null,
          proveedorId: it.proveedorId ? parseInt(String(it.proveedorId)) : null,
          proveedorTexto: it.proveedorTexto ? String(it.proveedorTexto).trim() : null,
          urgencia: ['alta', 'media', 'baja'].includes(String(it.urgencia)) ? String(it.urgencia) : 'media',
          precioEstimado: it.precioEstimado != null && it.precioEstimado !== '' ? parseFloat(String(it.precioEstimado)) : null,
          precioReal: it.precioReal != null && it.precioReal !== '' ? parseFloat(String(it.precioReal)) : null,
          comprado: Boolean(it.comprado),
          notas: it.notas ? String(it.notas).trim() : null,
          orden: idx,
        })),
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/compras/rutas/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.rutaCompra.delete({ where: { id: rutaId } })
  return NextResponse.json({ ok: true })
}
