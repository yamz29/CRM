'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Users, Pencil, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Actividad } from './tipos'

interface Props {
  actividad: Actividad
  readOnly: boolean
  guardando: boolean
  onGuardar: (id: number, data: Partial<Actividad>) => Promise<void>
  onEditarDetalles: () => void
  onClose: () => void
}

export function BarraInferior({ actividad, readOnly, guardando, onGuardar, onEditarDetalles, onClose }: Props) {
  const [cuadrilla, setCuadrilla] = useState(actividad.cuadrilla ?? '')
  const [notas, setNotas] = useState(actividad.notas ?? '')
  const [materiales, setMateriales] = useState(actividad.materiales ?? '')

  useEffect(() => {
    setCuadrilla(actividad.cuadrilla ?? '')
    setNotas(actividad.notas ?? '')
    setMateriales(actividad.materiales ?? '')
  }, [actividad])

  const sinCambios =
    cuadrilla === (actividad.cuadrilla ?? '') &&
    notas === (actividad.notas ?? '') &&
    materiales === (actividad.materiales ?? '')

  async function guardar() {
    if (readOnly || sinCambios) return
    const data: Partial<Actividad> = {}
    if (cuadrilla !== (actividad.cuadrilla ?? '')) data.cuadrilla = cuadrilla.trim() || null
    if (notas !== (actividad.notas ?? '')) data.notas = notas.trim() || null
    if (materiales !== (actividad.materiales ?? '')) data.materiales = materiales.trim() || null
    if (Object.keys(data).length === 0) return
    await onGuardar(actividad.id, data)
  }

  const txtCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-y disabled:opacity-50'

  return (
    <div className="border-2 border-primary/40 rounded-xl bg-card shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-bold text-foreground truncate">{actividad.nombre || 'Actividad'}</h3>
          {actividad.esCritica && actividad.estado !== 'Completado' && (
            <span className="flex items-center gap-1 text-2xs font-medium text-red-600 dark:text-red-400 shrink-0">
              <Flag className="w-3 h-3" /> Ruta crítica
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={onEditarDetalles}>
            <Pencil className="w-3.5 h-3.5" /> Editar detalles
          </Button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cuadrillas + Notas + Materiales (una sola vista) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-3">
        <div className="space-y-1">
          <Label>Cuadrillas / personal</Label>
          <textarea value={cuadrilla} onChange={e => setCuadrilla(e.target.value)} onBlur={guardar} disabled={readOnly}
            rows={4} className={txtCls}
            placeholder={'Pintores — 3 personas\nAyudantes — 2 personas\nSupervisor — 1 persona'} />
        </div>
        <div className="space-y-1">
          <Label>Notas</Label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} onBlur={guardar} disabled={readOnly}
            rows={4} className={txtCls} placeholder="Notas internas de la actividad..." />
        </div>
        <div className="space-y-1">
          <Label>Materiales sugeridos</Label>
          <textarea value={materiales} onChange={e => setMateriales(e.target.value)} onBlur={guardar} disabled={readOnly}
            rows={4} className={txtCls} placeholder={'Pintura lavable (18L)\nRodillos 9" (x4)\nBrochas (x3)'} />
        </div>
      </div>

      {!readOnly && (
        <div className="px-4 pb-3 flex items-center justify-end gap-3">
          <span className="text-2xs text-muted-foreground">Se guarda automáticamente al cambiar de tarea</span>
          <Button size="sm" onClick={guardar} disabled={guardando || sinCambios}>
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
          </Button>
        </div>
      )}
    </div>
  )
}
