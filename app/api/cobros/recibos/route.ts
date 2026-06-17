import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import {
  siguienteNumeroRecibo, validarAplicaciones, recalcularFactura,
  estadoRecibo, type AplicacionInput, type FacturaSaldo,
} from '@/lib/recibos'

export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied
  const sp = request.nextUrl.searchParams
  const where: Record<string, unknown> = {}
  const estado = sp.get('estado'); if (estado) where.estado = estado
  const clienteId = sp.get('clienteId'); if (clienteId) where.clienteId = parseInt(clienteId)
  const desde = sp.get('desde'); const hasta = sp.get('hasta')
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
      ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
    }
  }
  const recibos = await prisma.recibo.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true } },
      cuentaBancaria: { select: { id: true, nombre: true } },
      _count: { select: { aplicaciones: true } },
    },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  })
  return NextResponse.json(recibos)
}

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied
  const userId = request.headers.get('x-user-id')
  const createdBy = userId ? parseInt(userId) : null

  const body = await request.json().catch(() => null)
  const clienteId = parseInt(String(body?.clienteId))
  const monto = parseFloat(String(body?.monto))
  if (!clienteId || isNaN(clienteId)) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (!(monto > 0)) return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })

  const aplicaciones: AplicacionInput[] = Array.isArray(body?.aplicaciones)
    ? body.aplicaciones.map((a: { facturaId: number; monto: number }) => ({ facturaId: Number(a.facturaId), monto: Number(a.monto) }))
    : []

  if (aplicaciones.length > 0) {
    const facturas = await prisma.factura.findMany({
      where: { id: { in: aplicaciones.map(a => a.facturaId) }, tipo: 'ingreso' },
      select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
    })
    const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
    const errores = validarAplicaciones(monto, aplicaciones, map)
    if (errores.length) return NextResponse.json({ error: errores.join(' · ') }, { status: 400 })
    for (const f of facturas) {
      const cerrado = await validarProyectoNoCerrado(f.proyectoId)
      if (cerrado) return cerrado
    }
  }

  const fecha = new Date(body?.fecha || Date.now())
  const cuentaBancariaId = body?.cuentaBancariaId ? parseInt(String(body.cuentaBancariaId)) : null

  const result = await prisma.$transaction(async (tx) => {
    const anio = fecha.getFullYear()
    const ultimo = await tx.recibo.findFirst({
      where: { numero: { startsWith: `REC-${anio}-` } },
      orderBy: { numero: 'desc' }, select: { numero: true },
    })
    const numero = siguienteNumeroRecibo(ultimo?.numero ?? null, anio)
    const montoAplicado = aplicaciones.reduce((s, a) => s + a.monto, 0)

    const recibo = await tx.recibo.create({
      data: {
        numero, clienteId, fecha, monto,
        metodoPago: body?.metodoPago || 'Transferencia',
        cuentaBancariaId, referencia: body?.referencia || null,
        observaciones: body?.observaciones || null,
        montoAplicado, estado: estadoRecibo(monto, montoAplicado), createdBy,
      },
    })

    for (const a of aplicaciones) {
      await tx.aplicacionRecibo.create({ data: { reciboId: recibo.id, facturaId: a.facturaId, monto: a.monto } })
      await recalcularFactura(tx, a.facturaId)
    }

    if (cuentaBancariaId) {
      await tx.movimientoBancario.create({
        data: {
          cuentaBancariaId, fecha, tipo: 'credito', monto,
          descripcion: `Recibo ${numero}`, referencia: body?.referencia || null,
          conciliado: true, reciboId: recibo.id,
        },
      })
    }
    return recibo
  })

  return NextResponse.json(result, { status: 201 })
}
