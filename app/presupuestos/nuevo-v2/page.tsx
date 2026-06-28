import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { PresupuestoV2Builder } from '@/components/presupuestos/PresupuestoV2Builder'

export default async function NuevoPresupuestoV2Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const defaultClienteId = sp.clienteId ? parseInt(sp.clienteId) : undefined
  const defaultProyectoId = sp.proyectoId ? parseInt(sp.proyectoId) : undefined

  const [clientes, proyectos, unidades] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.proyecto.findMany({
      select: { id: true, nombre: true, clienteId: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.unidadGlobal.findMany({
      select: { codigo: true },
      orderBy: { codigo: 'asc' },
    }),
  ])
  const unidadesList = unidades.map((u) => u.codigo)

  return (
    <div className="space-y-6 max-w-7xl">
      <Breadcrumbs items={[{ label: 'Presupuestos', href: '/presupuestos' }, { label: 'Nuevo presupuesto' }]} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/presupuestos" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Presupuesto</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Constructor por capítulos y partidas
          </p>
        </div>
      </div>

      <PresupuestoV2Builder
        clientes={clientes}
        proyectos={proyectos}
        unidadesGlobales={unidadesList}
        mode="create"
        defaultClienteId={defaultClienteId}
        defaultProyectoId={defaultProyectoId}
      />
    </div>
  )
}
