import { BackButton } from '@/components/ui/back-button'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { PeriodoForm } from '@/components/nomina/PeriodoForm'

export default function NuevoPeriodoNominaPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Nómina', href: '/nomina' }, { label: 'Nuevo período' }]} />
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/nomina" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Período de Nómina</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Genera las líneas de pago de la quincena</p>
        </div>
      </div>
      <PeriodoForm />
    </div>
  )
}
