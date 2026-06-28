import { ImportarFacturasClient } from '@/components/contabilidad/ImportarFacturasClient'
import { BackButton } from '@/components/ui/back-button'

export default function ImportarFacturasPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/contabilidad?tab=facturas" className="hover:bg-muted/50" />
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
