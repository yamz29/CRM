import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string; pagoId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, pagoId } = await params
  const facturaId = parseInt(id)
  const pagoIdNum = parseInt(pagoId)

  if (isNaN(facturaId) || isNaN(pagoIdNum)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const pago = await prisma.pagoFactura.findUnique({ where: { id: pagoIdNum } })
    if (!pago || pago.facturaId !== facturaId) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      // Delete the pago
      await tx.pagoFactura.delete({ where: { id: pagoIdNum } })

      // Delete associated bank movement if exists
      if (pago.cuentaBancariaId) {
        await tx.movimientoBancario.deleteMany({
          where: {
            facturaId,
            cuentaBancariaId: pago.cuentaBancariaId,
            monto: pago.monto,
            fecha: pago.fecha,
          },
        })
      }

      // Recalculate factura totals
      const pagosRestantes = await tx.pagoFactura.aggregate({
        where: { facturaId },
        _sum: { monto: true },
      })
      const nuevoMontoPagado = pagosRestantes._sum.monto || 0
      const factura = await tx.factura.findUnique({ where: { id: facturaId } })
      const nuevoEstado = nuevoMontoPagado <= 0 ? 'pendiente' : nuevoMontoPagado >= (factura!.total - 0.01) ? 'pagada' : 'parcial'

      await tx.factura.update({
        where: { id: facturaId },
        data: { montoPagado: nuevoMontoPagado, estado: nuevoEstado },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pago:', error)
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 })
  }
}
