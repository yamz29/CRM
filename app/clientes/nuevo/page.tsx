import { ClienteForm } from '@/components/clientes/ClienteForm'
import { BackButton } from '@/components/ui/back-button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export default function NuevoClientePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Clientes', href: '/clientes' }, { label: 'Nuevo cliente' }]} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/clientes" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Cliente</h1>
          <p className="text-muted-foreground mt-0.5">Registra un nuevo cliente en el sistema</p>
        </div>
      </div>

      <ClienteForm mode="create" />
    </div>
  )
}
