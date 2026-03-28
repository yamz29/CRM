import { prisma } from '@/lib/prisma'
import { KitchenListClient } from '@/components/cocinas/KitchenListClient'

export const dynamic = 'force-dynamic'

export default async function CocinasPage() {
  const projects = await prisma.kitchenProject.findMany({
    include: {
      paredes: { select: { id: true } },
      placements: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const projectsWithCounts = projects.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    layoutType: p.layoutType,
    alturaMm: p.alturaMm,
    profBase: p.profBase,
    profAlto: p.profAlto,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    paredesCount: p.paredes.length,
    placementsCount: p.placements.length,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurador de Cocinas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Diseña y presupuesta proyectos de cocina colocando módulos sobre paredes
        </p>
      </div>
      <KitchenListClient initialProjects={projectsWithCounts} />
    </div>
  )
}
