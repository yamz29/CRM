import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { ReciboCreateSchema } from '@/lib/api-schemas'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import {
  siguienteNumeroRecibo, validarAplicaciones, recalcularFactura,
  estadoRecibo, type FacturaSaldo,
} from '@/lib/recibos'

export const GET = apiHandler({ modulo: 'contabilidad', nivel: 'ver' }, async (request) => {
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
})

export const POST = apiHandler(
  { modulo: 'contabilidad', nivel: 'editar', schema: ReciboCreateSchema },
  async (request, ctx) => {
    const body = ctx.body
    const userId = request.headers.get('x-user-id')
    const createdBy = userId ? parseInt(userId) : null

    const { clienteId, monto, aplicaciones } = body

    if (aplicaciones.length > 0) {
      const facturas = await prisma.factura.findMany({
        where: { id: { in: aplicaciones.map(a => a.facturaId) }, tipo: 'ingreso' },
        select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
      })
      const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
      const errores = validarAplicaciones(monto, aplicaciones, map)
      if (errores.length) throw new ApiError(400, errores.join(' · '))
      for (const f of facturas) {
        const cerrado = await validarProyectoNoCerrado(f.proyectoId)
        if (cerrado) return cerrado
      }
    }

    const fecha = body.fecha ?? new Date()
    const cuentaBancariaId = body.cuentaBancariaId ?? null

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
          metodoPago: body.metodoPago,
          cuentaBancariaId, referencia: body.referencia ?? null,
          observaciones: body.observaciones ?? null,
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
            descripcion: `Recibo ${numero}`, referencia: body.referencia ?? null,
            conciliado: true, reciboId: recibo.id,
          },
        })
      }
      return recibo
    })

    return NextResponse.json(result, { status: 201 })
  },
)
