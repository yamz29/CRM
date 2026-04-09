import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/compras — lista de órdenes de compra
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'compras', 'ver')
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const proveedorId = searchParams.get('proveedorId')
  const proyectoId = searchParams.get('proyectoId')

  const where: Record<string, unknown> = {}
  if (estado) where.estado = estado
  if (proveedorId) where.proveedorId = parseInt(proveedorId)
  if (proyectoId) where.proyectoId = parseInt(proyectoId)

  const ordenes = await prisma.ordenCompra.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      proveedor: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
      _count: { select: { items: true } },
    },
  })

  return NextResponse.json(ordenes)
}

// POST /api/compras — crear orden de compra
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'compras', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()
    const userId = request.headers.get('x-user-id')

    // Generar número secuencial OC-YYYY-NNNN
    const year = new Date().getFullYear()
    const prefix = `OC-${year}-`
    const last = await prisma.ordenCompra.findFirst({
      where: { numero: { startsWith: prefix } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    })
    const seq = last ? parseInt(last.numero.slice(prefix.length)) + 1 : 1
    const numero = `${prefix}${String(seq).padStart(4, '0')}`

    const orden = await prisma.ordenCompra.create({
      data: {
        numero,
        proveedorId: body.proveedorId ? parseInt(body.proveedorId) : null,
        proyectoId: body.proyectoId ? parseInt(body.proyectoId) : null,
        fechaEntrega: body.fechaEntrega ? new Date(body.fechaEntrega) : null,
        condicionesPago: body.condicionesPago?.toString().trim() || null,
        moneda: body.moneda || 'RD$',
        notas: body.notas?.toString().trim() || null,
        creadoPorId: userId ? parseInt(userId) : null,
      },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        items: true,
      },
    })

    return NextResponse.json(orden)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
