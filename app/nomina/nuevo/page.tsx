import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PeriodoForm } from '@/components/nomina/PeriodoForm'

export default function NuevoPeriodoNominaPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/nomina"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Período de Nómina</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Genera las líneas de pago de la quincena</p>
        </div>
      </div>
      <PeriodoForm />
    </div>
  )
}
