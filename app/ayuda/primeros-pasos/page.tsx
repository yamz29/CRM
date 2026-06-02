import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PrimerosPasosClient } from './PrimerosPasosClient'
import { GUIAS } from './guias'

export default async function PrimerosPasosPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>
}) {
  const { rol: rolRaw } = await searchParams
  const rolActivo = (['vendedor', 'supervisor', 'contable'].includes(rolRaw ?? '')
    ? rolRaw
    : 'vendedor') as 'vendedor' | 'supervisor' | 'contable'

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/ayuda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a Ayuda
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Primeros pasos</h1>
        <p className="text-muted-foreground mt-1">
          Guía secuencial para empezar a usar el ERP según tu rol. Elige tu rol abajo, sigue los pasos
          y mira el checklist a la derecha para ver tu progreso real.
        </p>
      </div>

      <PrimerosPasosClient rolActivo={rolActivo} guias={GUIAS} />
    </div>
  )
}
