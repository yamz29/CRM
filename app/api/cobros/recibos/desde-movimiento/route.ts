import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import {
  siguienteNumeroRecibo, validarAplicaciones, recalcularFactura,
  estadoRecibo, type AplicacionInput, type FacturaSaldo,
} from '@/lib/recibos'

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const userId = request.headers.get('x-user-id')
  const createdBy = userId ? parseInt(userId) : null

  const body = await request.json().catch(() => null)

  const movimientoId = parseInt(String(body?.movimientoId))
  const clienteId = parseInt(String(body?.clienteId))

  if (!movimientoId || isNaN(movimientoId)) {
    return NextResponse.json({ error: 'movimientoId requerido' }, { status: 400 })
  }
  if (!clienteId || isNaN(clienteId) || clienteId <= 0) {
    return NextResponse.json({ error: 'clienteId requerido y debe ser positivo' }, { status: 400 })
  }

  // Load the movimiento
  const movimiento = await prisma.movimientoBancario.findUnique({
    where: { id: movimientoId },
  })
  if (!movimiento) {
    return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  }
  if (movimiento.tipo !== 'credito') {
    return NextResponse.json({ error: 'Solo se pueden convertir movimientos de tipo crédito' }, { status: 400 })
  }
  if (movimiento.reciboId != null) {
    return NextResponse.json({ error: 'Este movimiento ya tiene un recibo asociado' }, { status: 400 })
  }

  // Validate clienteId exists
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 400 })
  }

  const aplicaciones: AplicacionInput[] = Array.isArray(body?.aplicaciones)
    ? body.aplicaciones.map((a: { facturaId: number; monto: number }) => ({
        facturaId: Number(a.facturaId),
        monto: Number(a.monto),
      }))
    : []

  if (aplicaciones.length > 0) {
    const facturas = await prisma.factura.findMany({
      where: { id: { in: aplicaciones.map(a => a.facturaId) }, tipo: 'ingreso' },
      select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
    })
    const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
    const errores = validarAplicaciones(movimiento.monto, aplicaciones, map)
    if (errores.length) return NextResponse.json({ error: errores.join(' · ') }, { status: 400 })

    for (const f of facturas) {
      const cerrado = await validarProyectoNoCerrado(f.proyectoId)
      if (cerrado) return cerrado
    }
  }

  const fecha = movimiento.fecha
  const cuentaBancariaId = movimiento.cuentaBancariaId

  const result = await prisma.$transaction(async (tx) => {
    const anio = fecha.getFullYear()
    const ultimo = await tx.recibo.findFirst({
      where: { numero: { startsWith: `REC-${anio}-` } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    })
    const numero = siguienteNumeroRecibo(ultimo?.numero ?? null, anio)
    const montoAplicado = aplicaciones.reduce((s, a) => s + a.monto, 0)

    const recibo = await tx.recibo.create({
      data: {
        numero,
        clienteId,
        fecha,
        monto: movimiento.monto,
        metodoPago: 'Transferencia',
        cuentaBancariaId,
        referencia: movimiento.referencia ?? null,
        observaciones: null,
        montoAplicado,
        estado: estadoRecibo(movimiento.monto, montoAplicado),
        createdBy,
      },
    })

    for (const a of aplicaciones) {
      await tx.aplicacionRecibo.create({ data: { reciboId: recibo.id, facturaId: a.facturaId, monto: a.monto } })
      await recalcularFactura(tx, a.facturaId)
    }

    // Link the movement to the new recibo and mark as conciliado
    await tx.movimientoBancario.update({
      where: { id: movimientoId },
      data: { reciboId: recibo.id, conciliado: true },
    })

    return recibo
  })

  return NextResponse.json(result, { status: 201 })
}
