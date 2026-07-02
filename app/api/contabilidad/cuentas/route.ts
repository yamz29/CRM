import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler } from '@/lib/api-handler'
import { CuentaCreateSchema } from '@/lib/api-schemas'

export const GET = apiHandler({ modulo: 'contabilidad', nivel: 'ver' }, async () => {
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { activa: true },
    orderBy: { nombre: 'asc' },
    include: {
      _count: { select: { movimientos: true, pagos: true } },
    },
  })

  // Saldo actual: un solo groupBy para todas las cuentas (antes era 1 query por cuenta)
  const agg = await prisma.movimientoBancario.groupBy({
    by: ['cuentaBancariaId', 'tipo'],
    where: { cuentaBancariaId: { in: cuentas.map((c) => c.id) } },
    _sum: { monto: true },
  })

  const cuentasConSaldo = cuentas.map((c) => {
    let saldo = c.saldoInicial
    for (const g of agg) {
      if (g.cuentaBancariaId !== c.id) continue
      saldo += (g.tipo === 'credito' ? 1 : -1) * (g._sum.monto || 0)
    }
    return { ...c, saldoActual: saldo }
  })

  return NextResponse.json(cuentasConSaldo)
})

export const POST = apiHandler(
  { modulo: 'contabilidad', nivel: 'editar', schema: CuentaCreateSchema },
  async (_req, ctx) => {
    const cuenta = await prisma.cuentaBancaria.create({ data: ctx.body })
    return NextResponse.json(cuenta, { status: 201 })
  },
)
