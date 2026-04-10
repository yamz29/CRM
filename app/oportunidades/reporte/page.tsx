import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ReportePipelineClient } from '@/components/oportunidades/ReportePipelineClient'

export const dynamic = 'force-dynamic'

export default function ReportePipelinePage() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/oportunidades"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-muted-foreground" />
              Reporte del Pipeline
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analiza el rendimiento de ventas: cierres, tasas de conversión y motivos de pérdida
            </p>
          </div>
        </div>
      </div>
      <ReportePipelineClient />
    </div>
  )
}
