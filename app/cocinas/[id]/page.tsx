import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { KitchenConfiguratorClient } from '@/components/cocinas/KitchenConfiguratorClient'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export default async function KitchenConfiguratorPage({ params }: Props) {
  const { id } = await params
  const projectId = parseInt(id)
  if (isNaN(projectId)) notFound()

  const project = await prisma.kitchenProject.findUnique({
    where: { id: projectId },
    include: {
      paredes: { orderBy: { orden: 'asc' } },
      placements: {
        include: {
          modulo: {
            select: {
              id: true,
              nombre: true,
              tipoModulo: true,
              ancho: true,
              alto: true,
              profundidad: true,
              colorAcabado: true,
              materialTableroId: true,
            },
          },
        },
        orderBy: { posicion: 'asc' },
      },
    },
  })

  if (!project) notFound()

  const availableModules = await prisma.moduloMelaminaV2.findMany({
    select: {
      id: true,
      nombre: true,
      tipoModulo: true,
      ancho: true,
      alto: true,
      profundidad: true,
      colorAcabado: true,
      materialTableroId: true,
    },
    orderBy: [{ tipoModulo: 'asc' }, { nombre: 'asc' }],
  })

  return (
    <KitchenConfiguratorClient
      project={project}
      availableModules={availableModules}
    />
  )
}
