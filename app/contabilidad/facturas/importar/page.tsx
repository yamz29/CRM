import { ImportarFacturasClient } from '@/components/contabilidad/ImportarFacturasClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function ImportarFacturasPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <Link
          href="/contabilidad?tab=facturas"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar facturas desde CSV</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Carga un archivo CSV con varias facturas de egreso de una sola vez
          </p>
        </div>
      </div>

      <ImportarFacturasClient />
    </div>
  )
}
