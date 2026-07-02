import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { AplicarReciboSchema } from '@/lib/api-schemas'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import { validarAplicaciones, recalcularFactura, recalcularRecibo, type FacturaSaldo } from '@/lib/recibos'

export const POST = apiHandler(
  { modulo: 'contabilidad', nivel: 'editar', schema: AplicarReciboSchema },
  async (_req, ctx) => {
    const id = ctx.id
    const recibo = await prisma.recibo.findUnique({ where: { id }, include: { aplicaciones: true } })
    if (!recibo) throw new ApiError(404, 'Recibo no encontrado')
    if (recibo.estado === 'anulado') throw new ApiError(400, 'Recibo anulado')

    const nuevas = ctx.body.aplicaciones

    const disponible = recibo.monto - recibo.montoAplicado
    const facturas = await prisma.factura.findMany({
      where: { id: { in: nuevas.map(a => a.facturaId) }, tipo: 'ingreso' },
      select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
    })
    const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
    const errores = validarAplicaciones(disponible, nuevas, map)
    if (errores.length) throw new ApiError(400, errores.join(' · '))
    for (const f of facturas) {
      const cerrado = await validarProyectoNoCerrado(f.proyectoId)
      if (cerrado) return cerrado
    }

    await prisma.$transaction(async (tx) => {
      for (const a of nuevas) {
        const existente = await tx.aplicacionRecibo.findUnique({
          where: { reciboId_facturaId: { reciboId: id, facturaId: a.facturaId } },
        })
        if (existente) {
          await tx.aplicacionRecibo.update({ where: { id: existente.id }, data: { monto: existente.monto + a.monto } })
        } else {
          await tx.aplicacionRecibo.create({ data: { reciboId: id, facturaId: a.facturaId, monto: a.monto } })
        }
        await recalcularFactura(tx, a.facturaId)
      }
      await recalcularRecibo(tx, id)
    })

    return NextResponse.json({ ok: true })
  },
)
