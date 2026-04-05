import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { FacturaDetalle } from '@/components/contabilidad/FacturaDetalle'

export default async function FacturaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [factura, cuentas] = await Promise.all([
    prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        pagos: {
          include: { cuentaBancaria: { select: { id: true, nombre: true, banco: true } } },
          orderBy: { fecha: 'desc' },
        },
      },
    }),
    prisma.cuentaBancaria.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, banco: true },
    }),
  ])

  if (!factura) notFound()

  return (
    <FacturaDetalle
      factura={JSON.parse(JSON.stringify(factura))}
      cuentas={cuentas}
    />
  )
}
