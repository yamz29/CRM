import { ClienteForm } from '@/components/clientes/ClienteForm'
import { ArrowLeft } from 'lucide-react'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import Link from 'next/link'

export default function NuevoClientePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Clientes', href: '/clientes' }, { label: 'Nuevo cliente' }]} />
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/clientes"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Cliente</h1>
          <p className="text-muted-foreground mt-0.5">Registra un nuevo cliente en el sistema</p>
        </div>
      </div>

      <ClienteForm mode="create" />
    </div>
  )
}
