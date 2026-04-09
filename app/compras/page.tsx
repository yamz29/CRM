import { prisma } from '@/lib/prisma'
import { ComprasPageClient } from '@/components/compras/ComprasPageClient'

export default async function ComprasPage() {
  const [ordenes, proveedores, proyectos] = await Promise.all([
    prisma.ordenCompra.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        proveedor: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.proveedor.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, condicionesPago: true },
    }),
    prisma.proyecto.findMany({
      where: { estado: { notIn: ['Cancelado', 'Completado'] } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  return (
    <ComprasPageClient
      ordenesIniciales={JSON.parse(JSON.stringify(ordenes))}
      proveedores={proveedores}
      proyectos={proyectos}
    />
  )
}
