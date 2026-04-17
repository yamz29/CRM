import { prisma } from '@/lib/prisma'
import { KitchenListClient } from '@/components/cocinas/KitchenListClient'
import { HelpDrawer } from '@/components/help/HelpDrawer'

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Espacios (Modulares)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Diseña y presupuesta espacios modulares colocando módulos sobre paredes
          </p>
        </div>
        <HelpDrawer slug="cocinas" titulo="Configurador de Cocinas" />
      </div>
      <KitchenListClient initialProjects={projectsWithCounts} />
    </div>
  )
}
