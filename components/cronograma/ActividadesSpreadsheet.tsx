'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Flag, Loader2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Actividad {
  id: number
  nombre: string
  duracion: number
  fechaInicio: string
  fechaFin: string
  pctAvance: number
  estado: string
  tipo: string
  dependenciaId: number | null
  tipoDependencia: string
  desfaseDias: number
  esCritica?: boolean
  holguraDias?: number
  orden?: number
}

interface Props {
  cronogramaId: number
  actividades: Actividad[]
  avanzado?: boolean  // muestra columnas adicionales: tipoDep, desfase
  onAvanzadoChange?: (v: boolean) => void
}

const TIPOS_DEP = [
  { value: 'FS', label: 'FS (Fin → Inicio)' },
  { value: 'SS', label: 'SS (Inicio → Inicio)' },
  { value: 'FF', label: 'FF (Fin → Fin)' },
  { value: 'SF', label: 'SF (Inicio → Fin)' },
]

export function ActividadesSpreadsheet({
  cronogramaId,
  actividades,
  avanzado = false,
  onAvanzadoChange,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: number; field: string } | null>(null)
  const [draft, setDraft] = useState<string>('')
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [localAvanzado, setLocalAvanzado] = useState(avanzado)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  const mostrarAvanzado = onAvanzadoChange ? avanzado : localAvanzado
  const setAvanzado = onAvanzadoChange ?? setLocalAvanzado

  // Autofocus del input en edición
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [editing])

  function beginEdit(id: number, field: string, value: unknown) {
    setDraft(value == null ? '' : String(value))
    setEditing({ id, field })
  }

  async function commitEdit() {
    if (!editing) return
    const { id, field } = editing
    const actividad = actividades.find(a => a.id === id)
    if (!actividad) { setEditing(null); return }

    // Determinar valor a enviar según campo
    let body: Record<string, unknown> = {}
    switch (field) {
      case 'nombre':
        if (draft.trim() === (actividad.nombre || '')) { setEditing(null); return }
        body = { nombre: draft.trim() }
        break
      case 'duracion': {
        const d = parseInt(draft) || 0
        if (d === actividad.duracion) { setEditing(null); return }
        body = { duracion: Math.max(1, d) }
        break
      }
      case 'pctAvance': {
        const p = Math.max(0, Math.min(100, parseFloat(draft) || 0))
        if (p === actividad.pctAvance) { setEditing(null); return }
        body = { pctAvance: p }
        break
      }
      case 'dependenciaId': {
        const depId = draft ? parseInt(draft) : null
        if (depId === actividad.dependenciaId) { setEditing(null); return }
        body = { dependenciaId: depId }
        break
      }
      case 'tipoDependencia':
        if (draft === actividad.tipoDependencia) { setEditing(null); return }
        body = { tipoDependencia: draft }
        break
      case 'desfaseDias': {
        const v = parseInt(draft) || 0
        if (v === actividad.desfaseDias) { setEditing(null); return }
        body = { desfaseDias: v }
        break
      }
      default:
        setEditing(null); return
    }

    setEditing(null)
    setSaving(s => new Set(s).add(id))
    try {
      const res = await fetch(`/api/cronograma/${cronogramaId}/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) router.refresh()
      else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Error al guardar')
      }
    } finally {
      setSaving(s => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
    }
  }

  function cancelEdit() {
    setEditing(null)
    setDraft('')
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta actividad?')) return
    setSaving(s => new Set(s).add(id))
    try {
      const res = await fetch(`/api/cronograma/${cronogramaId}/actividades/${id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function handleNuevaTarea() {
    const ultimoOrden = actividades.length > 0 ? Math.max(...actividades.map(a => a.orden ?? 0)) : 0
    const base = new Date().toISOString().slice(0, 10)
    try {
      const res = await fetch(`/api/cronograma/${cronogramaId}/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Nueva actividad',
          duracion: 1,
          fechaInicio: base,
          tipo: 'tarea',
          orden: ultimoOrden + 1,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        router.refresh()
        // Dar foco al nombre para editar inmediatamente
        setTimeout(() => beginEdit(data.id, 'nombre', 'Nueva actividad'), 100)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      // El próximo render autofocus al siguiente campo — lógica básica:
      // por ahora solo commit y listo.
    }
  }

  function fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })
  }

  // Nombre de dependencia para mostrar
  function nombreDep(a: Actividad): string {
    if (!a.dependenciaId) return '—'
    const pred = actividades.find(x => x.id === a.dependenciaId)
    return pred ? pred.nombre : `#${a.dependenciaId}`
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Actividades ({actividades.length})
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarAvanzado}
              onChange={e => setAvanzado(e.target.checked)}
              className="rounded border-border"
            />
            Avanzado
          </label>
          <Button size="sm" onClick={handleNuevaTarea} variant="secondary">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50 backdrop-blur z-10">
            <tr className="border-b border-border">
              <th className="w-5 px-1 py-2"></th>
              <th className="text-left px-2 py-2 font-semibold text-muted-foreground">Nombre</th>
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-14">Dur</th>
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-20">Inicio</th>
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-20">Fin</th>
              <th className="text-left px-2 py-2 font-semibold text-muted-foreground w-28">Depende de</th>
              {mostrarAvanzado && (
                <>
                  <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-20">Tipo</th>
                  <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-16">Desfase</th>
                </>
              )}
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-16">%</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actividades.length === 0 && (
              <tr><td colSpan={mostrarAvanzado ? 10 : 8} className="px-4 py-8 text-center text-muted-foreground">
                Sin actividades. Click en &ldquo;Nueva&rdquo; para agregar la primera.
              </td></tr>
            )}
            {actividades.map(a => {
              const isSaving = saving.has(a.id)
              return (
                <tr
                  key={a.id}
                  data-actividad-id={a.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    a.esCritica ? 'border-l-2 border-l-red-500' : ''
                  }`}
                >
                  <td className="px-1 py-1 text-muted-foreground/40">
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <GripVertical className="w-3 h-3" />}
                  </td>

                  {/* Nombre */}
                  <td className="px-1 py-1" onClick={() => beginEdit(a.id, 'nombre', a.nombre)}>
                    {editing?.id === a.id && editing.field === 'nombre' ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 border border-primary rounded text-xs bg-background"
                      />
                    ) : (
                      <div className="cursor-text flex items-center gap-1 px-1 py-0.5">
                        {a.tipo === 'hito' && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span className="truncate">{a.nombre}</span>
                        {a.esCritica && <span className="text-[9px] text-red-600 font-semibold ml-auto">crit</span>}
                      </div>
                    )}
                  </td>

                  {/* Duración */}
                  <td className="px-1 py-1 text-center" onClick={() => beginEdit(a.id, 'duracion', a.duracion)}>
                    {editing?.id === a.id && editing.field === 'duracion' ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="number"
                        min={0}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-12 px-1 py-0.5 border border-primary rounded text-xs bg-background text-center"
                      />
                    ) : (
                      <span className="cursor-text tabular-nums">{a.duracion}d</span>
                    )}
                  </td>

                  {/* Fecha inicio (read-only en spreadsheet, se edita desde gantt) */}
                  <td className="px-1 py-1 text-center text-muted-foreground tabular-nums">
                    {fmtFecha(a.fechaInicio)}
                  </td>
                  <td className="px-1 py-1 text-center text-muted-foreground tabular-nums">
                    {fmtFecha(a.fechaFin)}
                  </td>

                  {/* Dependencia */}
                  <td className="px-1 py-1" onClick={() => beginEdit(a.id, 'dependenciaId', a.dependenciaId ?? '')}>
                    {editing?.id === a.id && editing.field === 'dependenciaId' ? (
                      <select
                        ref={inputRef as React.RefObject<HTMLSelectElement>}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 border border-primary rounded text-xs bg-background"
                      >
                        <option value="">— Ninguna —</option>
                        {actividades.filter(x => x.id !== a.id).map(x => (
                          <option key={x.id} value={x.id}>{x.nombre}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="cursor-text truncate block">{nombreDep(a)}</span>
                    )}
                  </td>

                  {/* Tipo dependencia (solo avanzado) */}
                  {mostrarAvanzado && (
                    <td className="px-1 py-1 text-center" onClick={() => a.dependenciaId && beginEdit(a.id, 'tipoDependencia', a.tipoDependencia)}>
                      {editing?.id === a.id && editing.field === 'tipoDependencia' ? (
                        <select
                          ref={inputRef as React.RefObject<HTMLSelectElement>}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="w-full px-1 py-0.5 border border-primary rounded text-xs bg-background"
                        >
                          {TIPOS_DEP.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                        </select>
                      ) : (
                        <span className={`cursor-text font-mono ${!a.dependenciaId ? 'text-muted-foreground/40' : ''}`}>
                          {a.dependenciaId ? a.tipoDependencia : '—'}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Desfase (solo avanzado) */}
                  {mostrarAvanzado && (
                    <td className="px-1 py-1 text-center" onClick={() => a.dependenciaId && beginEdit(a.id, 'desfaseDias', a.desfaseDias)}>
                      {editing?.id === a.id && editing.field === 'desfaseDias' ? (
                        <input
                          ref={inputRef as React.RefObject<HTMLInputElement>}
                          type="number"
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          className="w-12 px-1 py-0.5 border border-primary rounded text-xs bg-background text-center"
                        />
                      ) : (
                        <span className={`cursor-text tabular-nums ${!a.dependenciaId ? 'text-muted-foreground/40' : ''}`}>
                          {a.dependenciaId ? a.desfaseDias : '—'}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Avance % */}
                  <td className="px-1 py-1 text-center" onClick={() => beginEdit(a.id, 'pctAvance', a.pctAvance)}>
                    {editing?.id === a.id && editing.field === 'pctAvance' ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="number"
                        min={0}
                        max={100}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-14 px-1 py-0.5 border border-primary rounded text-xs bg-background text-center"
                      />
                    ) : (
                      <span className="cursor-text tabular-nums">{Math.round(a.pctAvance)}%</span>
                    )}
                  </td>

                  {/* Acción eliminar */}
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                      className="text-muted-foreground/40 hover:text-red-600 transition-colors p-0.5"
                      title="Eliminar"
                      disabled={isSaving}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
