'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  abierto: boolean
  titulo: string
  descripcion?: string
  textoConfirmar?: string
  variante?: 'peligro' | 'primario'
  cargando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Diálogo de confirmación accesible para reemplazar los confirm() nativos.
 * Controlado: el padre decide cuándo está abierto y qué hacer al confirmar.
 */
export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  variante = 'primario',
  cargando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) onCancelar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, cargando, onCancelar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => { if (!cargando) onCancelar() }}
      />
      {/* Panel */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-start gap-3">
          {variante === 'peligro' && (
            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
            {descripcion && (
              <p className="text-sm text-muted-foreground mt-1.5">{descripcion}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" size="sm" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onConfirmar}
            disabled={cargando}
            className={variante === 'peligro' ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
          >
            {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  )
}
