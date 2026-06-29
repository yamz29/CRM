import { ResyncSharePointClient } from '@/components/contabilidad/ResyncSharePointClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function ResyncSharePointPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href="/contabilidad?tab=facturas"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Re-sincronizar facturas a SharePoint</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sube a SharePoint las facturas que quedaron guardadas solo en el servidor
          </p>
        </div>
      </div>

      <ResyncSharePointClient />
    </div>
  )
}
