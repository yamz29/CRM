import { prisma } from '@/lib/prisma'
import { ContabilidadClient } from './ContabilidadClient'

export default async function ContabilidadPage() {
  const [facturas, cuentasRaw, clientes] = await Promise.all([
    prisma.factura.findMany({
      orderBy: { fecha: 'desc' },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        _count: { select: { pagos: true } },
      },
    }),
    prisma.cuentaBancaria.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.cliente.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  // Calculate saldoActual for each account
  const cuentas = await Promise.all(
    cuentasRaw.map(async (c) => {
      const agg = await prisma.movimientoBancario.groupBy({
        by: ['tipo'],
        where: { cuentaBancariaId: c.id },
        _sum: { monto: true },
      })
      let creditos = 0, debitos = 0
      for (const g of agg) {
        if (g.tipo === 'credito') creditos = g._sum.monto || 0
        else debitos = g._sum.monto || 0
      }
      const saldoActual = c.tipoCuenta === 'tarjeta_credito'
        ? debitos - creditos  // deuda = gastos - pagos
        : c.saldoInicial + creditos - debitos
      return { ...c, saldoActual }
    })
  )

  // Compute summary
  const resumen = { totalIngresos: 0, totalEgresos: 0, cobrado: 0, pagado: 0, porCobrar: 0, porPagar: 0 }
  for (const f of facturas) {
    if (f.estado === 'anulada') continue
    if (f.tipo === 'ingreso') {
      resumen.totalIngresos += f.total
      resumen.cobrado += f.montoPagado
    } else {
      resumen.totalEgresos += f.total
      resumen.pagado += f.montoPagado
    }
  }
  resumen.porCobrar = resumen.totalIngresos - resumen.cobrado
  resumen.porPagar = resumen.totalEgresos - resumen.pagado

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          ✨ <strong>Nuevo:</strong> Ahora puedes ver facturas y gastos de proyectos unificados en una sola vista.
        </p>
        <a href="/contabilidad/transacciones" className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap">
          Ir a Transacciones →
        </a>
      </div>
      <ContabilidadClient
        facturasIniciales={JSON.parse(JSON.stringify(facturas))}
        cuentasIniciales={JSON.parse(JSON.stringify(cuentas))}
        clientes={clientes}
        resumen={resumen}
      />
    </>
  )
}
