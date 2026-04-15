import { prisma } from '@/lib/prisma'
import { TransaccionesClient } from './TransaccionesClient'

export default async function TransaccionesPage() {
  // Cargar datos auxiliares para filtros y formulario
  const [proyectos, clientes, proveedores] = await Promise.all([
    prisma.proyecto.findMany({
      where: { archivada: false },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.proveedor.findMany({
      select: { id: true, nombre: true, rnc: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  return (
    <div className="space-y-4">
      <TransaccionesClient
        proyectos={proyectos}
        clientes={clientes}
        proveedores={proveedores}
      />
    </div>
  )
}
