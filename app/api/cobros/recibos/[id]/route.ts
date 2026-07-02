import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'

export const GET = apiHandler({ modulo: 'contabilidad', nivel: 'ver' }, async (_req, ctx) => {
  const recibo = await prisma.recibo.findUnique({
    where: { id: ctx.id },
    include: {
      cliente: { select: { id: true, nombre: true } },
      cuentaBancaria: { select: { id: true, nombre: true } },
      aplicaciones: { include: { factura: { select: { id: true, numero: true, total: true, montoPagado: true } } } },
    },
  })
  if (!recibo) throw new ApiError(404, 'Recibo no encontrado')
  return NextResponse.json(recibo)
})
