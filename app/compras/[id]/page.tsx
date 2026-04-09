import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { OrdenCompraDetail } from '@/components/compras/OrdenCompraDetail'

export default async function OrdenCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ordenId = parseInt(id)
  if (isNaN(ordenId)) notFound()

  const [orden, proveedores, proyectos] = await Promise.all([
    prisma.ordenCompra.findUnique({
      where: { id: ordenId },
      include: {
        proveedor: { select: { id: true, nombre: true, rnc: true, condicionesPago: true, telefono: true, correo: true } },
        proyecto: { select: { id: true, nombre: true } },
        items: { orderBy: { createdAt: 'asc' } },
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

  if (!orden) notFound()

  return (
    <OrdenCompraDetail
      ordenInicial={JSON.parse(JSON.stringify(orden))}
      proveedores={proveedores}
      proyectos={proyectos}
    />
  )
}
