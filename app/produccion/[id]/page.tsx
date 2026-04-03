import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { OrdenProduccionDetail } from '@/components/produccion/OrdenProduccionDetail'

export default async function OrdenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: parseInt(id) },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      items: {
        include: {
          asignaciones: {
            where: { activo: true },
            include: { usuario: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      materiales: {
        include: { material: { select: { id: true, nombre: true, tipo: true } } },
        orderBy: { nombre: 'asc' },
      },
    },
  })

  if (!orden) notFound()

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  // Serialize dates
  const ordenSerial = {
    ...orden,
    fechaInicio: orden.fechaInicio?.toISOString() || null,
    fechaEstimada: orden.fechaEstimada?.toISOString() || null,
    fechaCompletada: orden.fechaCompletada?.toISOString() || null,
    createdAt: orden.createdAt.toISOString(),
    updatedAt: orden.updatedAt.toISOString(),
    items: orden.items.map(i => ({
      ...i,
      fechaInicioEtapa: i.fechaInicioEtapa?.toISOString() || null,
      fechaCompletado: i.fechaCompletado?.toISOString() || null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      asignaciones: i.asignaciones.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
    materiales: orden.materiales.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  }

  return <OrdenProduccionDetail orden={ordenSerial} usuarios={usuarios} />
}
