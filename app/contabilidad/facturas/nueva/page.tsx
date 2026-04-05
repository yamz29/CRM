import { prisma } from '@/lib/prisma'
import { FacturaForm } from '@/components/contabilidad/FacturaForm'

export default async function NuevaFacturaPage() {
  const [clientes, proyectos] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
    prisma.proyecto.findMany({
      where: { estado: { notIn: ['Cancelado', 'Cerrado'] } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  return <FacturaForm clientes={clientes} proyectos={proyectos} />
}
