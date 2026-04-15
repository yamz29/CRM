'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Pencil, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Partida {
  id: number
  codigo: string | null
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotalPresupuestado: number
  gastoReal: number
}

interface Props {
  proyectoId: number
  partida: Partida
  onClose: () => void
  onSuccess: () => void
}

export function EditarPartidaModal({ proyectoId, partida, onClose, onSuccess }: Props) {
  const [codigo, setCodigo] = useState(partida.codigo ?? '')
  const [descripcion, setDescripcion] = useState(partida.descripcion)
  const [unidad, setUnidad] = useState(partida.unidad)
  const [cantidad, setCantidad] = useState(String(partida.cantidad))
  const [precioUnitario, setPrecioUnitario] = useState(String(partida.precioUnitario))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = (parseFloat(cantidad) || 0) * (parseFloat(precioUnitario) || 0)
  const tieneGastos = partida.gastoReal > 0

  async function handleSave() {
    if (!descripcion.trim()) {
      setError('La descripción es obligatoria')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/partidas/${partida.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          descripcion,
          unidad,
          cantidad: parseFloat(cantidad) || 0,
          precioUnitario: parseFloat(precioUnitario) || 0,
        }),
      })
      if (res.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al guardar')
      }
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const msg = tieneGastos
      ? `Esta partida tiene ${formatCurrency(partida.gastoReal)} en gastos registrados.\n\n¿Eliminar la partida? Los gastos quedarán sin clasificar.`
      : '¿Eliminar esta partida?'
    if (!confirm(msg)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/partidas/${partida.id}`, { method: 'DELETE' })
      if (res.ok) {
        onSuccess()
        onClose()
      } else {
        setError('Error al eliminar')
      }
    } catch {
      setError('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Editar partida</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="ej: 01.01"
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción *</label>
              <input
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unidad</label>
              <input
                value={unidad}
                onChange={e => setUnidad(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cantidad</label>
              <input
                type="number"
                step="0.01"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Precio unit.</label>
              <input
                type="number"
                step="0.01"
                value={precioUnitario}
                onChange={e => setPrecioUnitario(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input tabular-nums"
              />
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal presupuestado:</span>
            <span className="font-bold text-foreground tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          {tieneGastos && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Esta partida ya tiene <strong>{formatCurrency(partida.gastoReal)}</strong> en gastos registrados. Cambiar el código NO afecta los gastos ya registrados.</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Eliminar
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving || deleting}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || deleting || !descripcion.trim()}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
