import { prisma } from '@/lib/prisma'
import { FacturaForm } from '@/components/contabilidad/FacturaForm'

export default async function NuevaFacturaPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })

  return <FacturaForm clientes={clientes} />
}
