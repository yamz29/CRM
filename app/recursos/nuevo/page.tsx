import { BackButton } from '@/components/ui/back-button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { RecursoForm } from '@/components/recursos/RecursoForm'

export default function NuevoRecursoPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Recursos', href: '/recursos' }, { label: 'Nuevo recurso' }]} />
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/recursos" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Recurso</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Agregar recurso al catálogo maestro</p>
        </div>
      </div>
      <RecursoForm mode="create" />
    </div>
  )
}
