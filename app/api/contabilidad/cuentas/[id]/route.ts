import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { CuentaUpdateSchema } from '@/lib/api-schemas'

export const PUT = apiHandler(
  { modulo: 'contabilidad', nivel: 'editar', schema: CuentaUpdateSchema },
  async (_req, ctx) => {
    const cuenta = await prisma.cuentaBancaria.update({
      where: { id: ctx.id },
      data: ctx.body,
    })
    return NextResponse.json(cuenta)
  },
)

export const DELETE = apiHandler({ modulo: 'contabilidad', nivel: 'admin' }, async (_req, ctx) => {
  // Bloquear si hay movimientos sin conciliar
  const pendientes = await prisma.movimientoBancario.count({
    where: { cuentaBancariaId: ctx.id, conciliado: false },
  })
  if (pendientes > 0) {
    throw new ApiError(409, `No se puede desactivar: tiene ${pendientes} movimiento(s) sin conciliar`)
  }

  // Soft delete — marcar como inactiva
  await prisma.cuentaBancaria.update({
    where: { id: ctx.id },
    data: { activa: false },
  })
  return NextResponse.json({ success: true })
})
