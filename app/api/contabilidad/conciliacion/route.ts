import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// POST: Conciliar un movimiento bancario con una factura
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()
    const { movimientoId, facturaId } = body

    if (!movimientoId) {
      return NextResponse.json({ error: 'movimientoId es requerido' }, { status: 400 })
    }

    const movimiento = await prisma.movimientoBancario.findUnique({ where: { id: parseInt(String(movimientoId)) } })
    if (!movimiento) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

    // Validate tipo consistency when linking
    if (facturaId) {
      const factura = await prisma.factura.findUnique({ where: { id: parseInt(String(facturaId)) } })
      if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })

      const esCompatible =
        (movimiento.tipo === 'debito' && factura.tipo === 'egreso') ||
        (movimiento.tipo === 'credito' && factura.tipo === 'ingreso')
      if (!esCompatible) {
        return NextResponse.json(
          { error: `Tipo incompatible: movimiento ${movimiento.tipo} no puede conciliarse con factura de ${factura.tipo}` },
          { status: 422 }
        )
      }
    }

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
