'use client'

import { useState } from 'react'
import { XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const CATEGORIAS_PERDIDA = [
  'Precio alto',
  'Competencia',
  'Tiempos de entrega',
  'Sin presupuesto',
  'No responde',
  'Proyecto cancelado',
  'Calidad / Especificaciones',
  'Otro',
]

interface Props {
  /** ID de la oportunidad a marcar como perdida */
  oportunidadId: number
  /** Nombre de la oportunidad (para contexto visual) */
  oportunidadNombre?: string
  onClose: () => void
  /** Llamado después de guardar con éxito */
  onSuccess: () => void
}

export function MarcarPerdidaModal({ oportunidadId, oportunidadNombre, onClose, onSuccess }: Props) {
  const [categoria, setCategoria] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!categoria) {
      setError('Selecciona una categoría')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/oportunidades/${oportunidadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa: 'Perdido',
          categoriaPerdida: categoria,
          motivoPerdida: motivo || null,
        }),
      })
      if (res.ok) {
        onSuccess()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al marcar como perdida')
      }
    } catch {
      setError('Error al marcar como perdida')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Marcar como perdida</h3>
            {oportunidadNombre && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{oportunidadNombre}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Categoría de pérdida <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {CATEGORIAS_PERDIDA.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`text-xs px-2 py-2 rounded-lg border-2 transition-colors text-left ${
                  categoria === cat
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-medium'
                    : 'border-border text-muted-foreground hover:border-border hover:bg-muted/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Detalles del motivo (opcional)
          </label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="ej: El cliente decidió otro proveedor por mejor precio, tiempos de entrega muy largos..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !categoria}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : 'Confirmar pérdida'}
          </Button>
        </div>
      </div>
    </div>
  )
}
