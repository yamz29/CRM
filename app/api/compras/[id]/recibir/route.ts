import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// POST /api/compras/[id]/recibir — registrar recepción de items
// Body: { items: [{ itemId: number, cantidadRecibida: number }] }
export async function POST(
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
    const itemsRecibidos: { itemId: number; cantidadRecibida: number }[] = body.items || []

    if (itemsRecibidos.length === 0) {
      return NextResponse.json({ error: 'No hay items para recibir' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const { itemId, cantidadRecibida } of itemsRecibidos) {
        await tx.itemOrdenCompra.update({
          where: { id: itemId },
          data: { cantidadRecibida },
        })
      }

      // Determinar estado: si todos recibidos completo → recibida, parcial → recibida_parcial
      const allItems = await tx.itemOrdenCompra.findMany({ where: { ordenCompraId: ordenId } })
      const todosRecibidos = allItems.every((i: { cantidadRecibida: number; cantidad: number }) => i.cantidadRecibida >= i.cantidad)
      const algunoRecibido = allItems.some((i: { cantidadRecibida: number }) => i.cantidadRecibida > 0)

      let estado = 'enviada'
      if (todosRecibidos) {
        estado = 'recibida'
      } else if (algunoRecibido) {
        estado = 'recibida_parcial'
      }

      await tx.ordenCompra.update({
        where: { id: ordenId },
        data: {
          estado,
          fechaRecepcion: todosRecibidos ? new Date() : undefined,
        },
      })
    })

    const orden = await prisma.ordenCompra.findUnique({
      where: { id: ordenId },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    })

    return NextResponse.json(orden)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al registrar recepción'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
