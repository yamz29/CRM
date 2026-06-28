import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { NuevoCronogramaForm } from '@/components/cronograma/NuevoCronogramaForm'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export default async function NuevoCronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ proyectoId?: string; presupuestoId?: string }>
}) {
  const sp = await searchParams

  const [proyectos, presupuestos] = await Promise.all([
    prisma.proyecto.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.presupuesto.findMany({
      where: { estado: 'Aprobado' },
      select: { id: true, numero: true, total: true, proyecto: { select: { nombre: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <Breadcrumbs items={[{ label: 'Cronogramas', href: '/cronograma' }, { label: 'Nuevo cronograma' }]} />
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/cronograma" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Cronograma</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Crea vacío o genera actividades desde un presupuesto</p>
        </div>
      </div>

      <NuevoCronogramaForm
        proyectos={proyectos}
        presupuestos={presupuestos}
        defaultProyectoId={sp.proyectoId ? parseInt(sp.proyectoId) : undefined}
        defaultPresupuestoId={sp.presupuestoId ? parseInt(sp.presupuestoId) : undefined}
      />
    </div>
  )
}
