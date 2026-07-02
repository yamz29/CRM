import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { PeriodoNominaUpdateSchema } from '@/lib/api-schemas'

export const GET = apiHandler({ modulo: 'nomina', nivel: 'ver' }, async (_req, ctx) => {
  const periodo = await prisma.periodoNomina.findUnique({
    where: { id: ctx.id },
    include: {
      lineas: {
        include: { empleado: true },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!periodo) throw new ApiError(404, 'No encontrado')
  return NextResponse.json(periodo)
})

export const PUT = apiHandler(
  { modulo: 'nomina', nivel: 'editar', schema: PeriodoNominaUpdateSchema },
  async (_req, ctx) => {
    const data: Record<string, unknown> = {}
    if (ctx.body.estado !== undefined) data.estado = ctx.body.estado
    if (ctx.body.fechaPago !== undefined) data.fechaPago = ctx.body.fechaPago

    const periodo = await prisma.periodoNomina.update({ where: { id: ctx.id }, data })
    return NextResponse.json(periodo)
  },
)

export const DELETE = apiHandler({ modulo: 'nomina', nivel: 'editar' }, async (_req, ctx) => {
  const periodo = await prisma.periodoNomina.findUnique({ where: { id: ctx.id } })
  if (!periodo) throw new ApiError(404, 'No encontrado')
  if (periodo.estado !== 'Borrador') {
    throw new ApiError(400, 'Solo se pueden eliminar períodos en Borrador')
  }
  await prisma.periodoNomina.delete({ where: { id: ctx.id } })
  return NextResponse.json({ success: true })
})
