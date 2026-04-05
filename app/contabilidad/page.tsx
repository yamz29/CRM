import { prisma } from '@/lib/prisma'
import { ContabilidadClient } from './ContabilidadClient'

export default async function ContabilidadPage() {
  const [facturas, cuentas, clientes] = await Promise.all([
    prisma.factura.findMany({
      orderBy: { fecha: 'desc' },
      include: {
        cliente: { select: { id: true, nombre: true } },
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
    <ContabilidadClient
      facturasIniciales={JSON.parse(JSON.stringify(facturas))}
      cuentasIniciales={JSON.parse(JSON.stringify(cuentas))}
      clientes={clientes}
      resumen={resumen}
    />
  )
}
