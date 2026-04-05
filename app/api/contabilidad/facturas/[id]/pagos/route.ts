import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const facturaId = parseInt((await params).id)
  if (isNaN(facturaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const pagos = await prisma.pagoFactura.findMany({
      where: { facturaId },
      include: { cuentaBancaria: { select: { id: true, nombre: true, banco: true } } },
      orderBy: { fecha: 'desc' },
    })
    return NextResponse.json(pagos)
  } catch (error) {
    console.error('Error fetching pagos:', error)
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const facturaId = parseInt((await params).id)
  if (isNaN(facturaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const factura = await prisma.factura.findUnique({ where: { id: facturaId } })
    if (!factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    if (factura.estado === 'anulada') {
      return NextResponse.json({ error: 'No se puede pagar una factura anulada' }, { status: 400 })
    }

    const body = await request.json()
    const { fecha, monto, metodoPago, referencia, cuentaBancariaId, observaciones } = body

    const montoNum = parseFloat(String(monto))
    if (!montoNum || montoNum <= 0) {
      return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })
    }

    const saldoPendiente = factura.total - factura.montoPagado
    if (montoNum > saldoPendiente + 0.01) {
      return NextResponse.json({ error: `Monto excede el saldo pendiente (${saldoPendiente.toFixed(2)})` }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const pago = await tx.pagoFactura.create({
        data: {
          facturaId,
          fecha: new Date(fecha || Date.now()),
          monto: montoNum,
          metodoPago: metodoPago || 'Transferencia',
          referencia: referencia || null,
          cuentaBancariaId: cuentaBancariaId ? parseInt(String(cuentaBancariaId)) : null,
          observaciones: observaciones || null,
        },
        include: { cuentaBancaria: { select: { id: true, nombre: true, banco: true } } },
      })

      const nuevoMontoPagado = factura.montoPagado + montoNum
      const nuevoEstado = nuevoMontoPagado >= factura.total - 0.01 ? 'pagada' : 'parcial'

      await tx.factura.update({
        where: { id: facturaId },
        data: { montoPagado: nuevoMontoPagado, estado: nuevoEstado },
      })

      return pago
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating pago:', error)
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 })
  }
}
