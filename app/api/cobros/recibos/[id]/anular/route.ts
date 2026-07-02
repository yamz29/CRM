import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { recalcularFactura } from '@/lib/recibos'

export const POST = apiHandler({ modulo: 'contabilidad', nivel: 'editar' }, async (_req, ctx) => {
  const id = ctx.id
  const recibo = await prisma.recibo.findUnique({ where: { id }, include: { aplicaciones: true } })
  if (!recibo) throw new ApiError(404, 'Recibo no encontrado')
  if (recibo.estado === 'anulado') throw new ApiError(400, 'Ya está anulado')

  const facturaIds = recibo.aplicaciones.map(a => a.facturaId)
  await prisma.$transaction(async (tx) => {
    await tx.aplicacionRecibo.deleteMany({ where: { reciboId: id } })
    await tx.movimientoBancario.deleteMany({ where: { reciboId: id } })
    await tx.recibo.update({ where: { id }, data: { estado: 'anulado', montoAplicado: 0 } })
    for (const fid of facturaIds) await recalcularFactura(tx, fid)
  })
  return NextResponse.json({ ok: true })
})
