'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, TrendingUp } from 'lucide-react'
import type { Actividad } from './CronogramaClient'

interface Props {
  actividad: Actividad
  usuarios: { id: number; nombre: string }[]
  onGuardar: (actividadId: number, pct: number, comentario: string, usuarioId?: number) => Promise<void>
  onClose: () => void
  loading: boolean
}

export function AvanceModal({ actividad, usuarios, onGuardar, onClose, loading }: Props) {
  const [pct, setPct] = useState(actividad.pctAvance)
  const [comentario, setComentario] = useState('')
  const [usuarioId, setUsuarioId] = useState<string>('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <h3 className="text-base font-bold text-foreground">Registrar Avance</h3>
            </div>
            <p className="text-sm text-muted-foreground">{actividad.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slider % */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Porcentaje de avance</Label>
            <span className="text-2xl font-black text-foreground tabular-nums">{Math.round(pct)}%</span>
          </div>
          <input
            type="range" min="0" max="100" step="5"
            value={pct}
            onChange={e => setPct(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex gap-2">
            {[0, 25, 50, 75, 100].map(v => (
              <button key={v} onClick={() => setPct(v)}
                className={`flex-1 py-1 text-xs font-medium rounded-lg border transition-colors ${pct === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {v}%
              </button>
            ))}
          </div>
        </div>

        {/* Responsable */}
        {usuarios.length > 0 && (
          <div className="space-y-1">
            <Label>Reportado por</Label>
            <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)}
              className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background">
              <option value="">Sin especificar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        )}

        {/* Comentario */}
        <div className="space-y-1">
          <Label>Comentario (opcional)</Label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)}
            rows={2} placeholder="Observaciones del avance..."
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {/* Historial reciente */}
        {actividad.avances.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Historial reciente</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {actividad.avances.map(av => (
                <div key={av.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1 border-b border-border/50 last:border-0">
                  <span className="font-bold text-foreground tabular-nums">{av.pctAvance}%</span>
                  <span>{new Date(av.fecha).toLocaleDateString('es-DO')}</span>
                  {av.comentario && <span className="truncate text-muted-foreground/70">— {av.comentario}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <Button onClick={() => onGuardar(actividad.id, pct, comentario, usuarioId ? parseInt(usuarioId) : undefined)}
            disabled={loading} className="flex-1">
            {loading ? 'Guardando…' : 'Guardar avance'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
