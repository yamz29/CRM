import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST: Conciliar un movimiento bancario con una factura
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { movimientoId, facturaId } = body

    if (!movimientoId) {
      return NextResponse.json({ error: 'movimientoId es requerido' }, { status: 400 })
    }

    const movimiento = await prisma.movimientoBancario.findUnique({ where: { id: parseInt(String(movimientoId)) } })
    if (!movimiento) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

    // If facturaId is null, we're un-reconciling
    const updated = await prisma.movimientoBancario.update({
      where: { id: movimiento.id },
      data: {
        conciliado: !!facturaId,
        facturaId: facturaId ? parseInt(String(facturaId)) : null,
      },
      include: {
        factura: { select: { id: true, numero: true, tipo: true, proveedor: true, total: true } },
        cuentaBancaria: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error conciliando:', error)
    return NextResponse.json({ error: 'Error al conciliar' }, { status: 500 })
  }
}
