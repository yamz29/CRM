'use client'

import { X } from 'lucide-react'

/**
 * Barra flotante de acciones masivas. Se muestra sólo cuando hay selección.
 * El consumidor pasa los controles de acción como `children` (botones, selects…)
 * para mantenerla agnóstica del dominio.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
  sustantivo = 'seleccionada',
}: {
  count: number
  onClear: () => void
  children: React.ReactNode
  /** Palabra en singular para el contador (ej. "tarea", "recurso"). */
  sustantivo?: string
}) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="text-sm font-medium text-foreground whitespace-nowrap">
        {count} {sustantivo}{count !== 1 ? 's' : ''}
      </span>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-2">{children}</div>
      <button
        onClick={onClear}
        className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Limpiar selección"
        aria-label="Limpiar selección"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
