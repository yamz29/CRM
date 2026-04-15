'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Combine, AlertTriangle, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Partida {
  id: number
  codigo: string | null
  descripcion: string
  subtotalPresupuestado: number
  cantidad: number
  unidad: string
}

interface Props {
  proyectoId: number
  partidas: Partida[]   // partidas seleccionadas a fusionar (2+)
  onClose: () => void
  onSuccess: () => void
}

export function FusionarManualModal({ proyectoId, partidas, onClose, onSuccess }: Props) {
  const [targetId, setTargetId] = useState<number>(partidas[0]?.id ?? 0)
  const [descripcion, setDescripcion] = useState(partidas[0]?.descripcion ?? '')
  const [codigo, setCodigo] = useState(partidas[0]?.codigo ?? '')
  const [fusionando, setFusionando] = useState(false)

  const total = partidas.reduce((s, p) => s + p.subtotalPresupuestado, 0)
  const totalCantidad = partidas.reduce((s, p) => s + p.cantidad, 0)

  function setTarget(p: Partida) {
    setTargetId(p.id)
    setDescripcion(p.descripcion)
    setCodigo(p.codigo ?? '')
  }

  async function handleFusionar() {
    setFusionando(true)
    const res = await fetch(`/api/proyectos/${proyectoId}/partidas/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partidaIds: partidas.map(p => p.id),
        targetPartidaId: targetId,
        nuevaDescripcion: descripcion,
        nuevoCodigo: codigo,
      }),
    })
    if (res.ok) {
      onSuccess()
      onClose()
    } else {
      alert('Error al fusionar las partidas')
      setFusionando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Combine className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Fusionar {partidas.length} partidas</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Se sumarán cantidades y subtotales. Los gastos registrados se reasignarán a la partida destino. Las demás se eliminarán.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Elige la partida destino</p>
            <div className="space-y-1.5">
              {partidas.map(p => (
                <label key={p.id} className={`flex items-start gap-3 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                  targetId === p.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                }`}>
                  <input
                    type="radio"
                    name="target"
                    checked={targetId === p.id}
                    onChange={() => setTarget(p)}
                    className="mt-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground font-mono">{p.codigo ?? '—'}</span>
                      <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(p.subtotalPresupuestado)}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 truncate">{p.descripcion}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código final</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción final</label>
              <input
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded bg-input"
              />
            </div>
          </div>

          <div className="bg-muted/30 border border-border rounded-lg px-3 py-2 space-y-0.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad total:</span>
              <span className="font-semibold tabular-nums">{totalCantidad.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal presupuestado final:</span>
              <span className="font-bold text-foreground tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={fusionando}>Cancelar</Button>
          <Button size="sm" onClick={handleFusionar} disabled={fusionando}>
            {fusionando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fusionando...</> : <><Combine className="w-3.5 h-3.5" /> Fusionar</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
