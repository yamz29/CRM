import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { ProyectoForm } from '@/components/proyectos/ProyectoForm'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export default async function NuevoProyectoPage({
  searchParams,
}: {
  searchParams: { clienteId?: string }
}) {
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Proyectos', href: '/proyectos' }, { label: 'Nuevo proyecto' }]} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/proyectos" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Proyecto</h1>
          <p className="text-muted-foreground mt-0.5">Registra un nuevo proyecto en el sistema</p>
        </div>
      </div>

      <ProyectoForm
        clientes={clientes}
        mode="create"
        defaultClienteId={searchParams.clienteId}
      />
    </div>
  )
}
