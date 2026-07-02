import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { ReciboDesdeMovimientoSchema } from '@/lib/api-schemas'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import {
  siguienteNumeroRecibo, validarAplicaciones, recalcularFactura,
  estadoRecibo, type FacturaSaldo,
} from '@/lib/recibos'

export const POST = apiHandler(
  { modulo: 'contabilidad', nivel: 'editar', schema: ReciboDesdeMovimientoSchema },
  async (request, ctx) => {
    const { movimientoId, clienteId, aplicaciones } = ctx.body
    const userId = request.headers.get('x-user-id')
    const createdBy = userId ? parseInt(userId) : null

    // Load the movimiento
    const movimiento = await prisma.movimientoBancario.findUnique({
      where: { id: movimientoId },
    })
    if (!movimiento) throw new ApiError(404, 'Movimiento no encontrado')
    if (movimiento.tipo !== 'credito') {
      throw new ApiError(400, 'Solo se pueden convertir movimientos de tipo crédito')
    }
    if (movimiento.reciboId != null) {
      throw new ApiError(400, 'Este movimiento ya tiene un recibo asociado')
    }

    // Validate clienteId exists
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })
    if (!cliente) throw new ApiError(400, 'Cliente no encontrado')

    if (aplicaciones.length > 0) {
      const facturas = await prisma.factura.findMany({
        where: { id: { in: aplicaciones.map(a => a.facturaId) }, tipo: 'ingreso' },
        select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
      })
      const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
      const errores = validarAplicaciones(movimiento.monto, aplicaciones, map)
      if (errores.length) throw new ApiError(400, errores.join(' · '))

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
  },
)
