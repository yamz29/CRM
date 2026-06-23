import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { RutaCompraDetail } from './RutaCompraDetail'

export default async function RutaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) notFound()

  const ruta = await prisma.rutaCompra.findUnique({
    where: { id: rutaId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: {
          proveedor: { select: { id: true, nombre: true, direccion: true, telefono: true } },
          proyecto: { select: { id: true, nombre: true } },
        },
      },
    },
  })

  if (!ruta) notFound()

  return <RutaCompraDetail rutaInicial={JSON.parse(JSON.stringify(ruta))} />
}
