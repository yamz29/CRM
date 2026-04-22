'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Flag, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
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
  avanzado?: boolean
  onAvanzadoChange?: (v: boolean) => void
}

const TIPOS_DEP = [
  { value: 'FS', label: 'FS' },
  { value: 'SS', label: 'SS' },
  { value: 'FF', label: 'FF' },
  { value: 'SF', label: 'SF' },
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

  // Orden estable por campo `orden` para mostrar numeración # consistente
  const actividadesOrdenadas = [...actividades].sort((a, b) => {
    const oa = a.orden ?? 0
    const ob = b.orden ?? 0
    if (oa !== ob) return oa - ob
    return a.id - b.id
  })

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [editing])

  function beginEdit(id: number, field: string, value: unknown) {
    if (saving.has(id)) return
    setDraft(value == null ? '' : String(value))
    setEditing({ id, field })
  }

  async function saveField(id: number, body: Record<string, unknown>) {
    setSaving(s => new Set(s).add(id))
    try {
      const res = await fetch(`/api/cronograma/${cronogramaId}/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        router.refresh()
      } else {
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

  async function commitEdit() {
    if (!editing) return
    const { id, field } = editing
    const actividad = actividades.find(a => a.id === id)
    if (!actividad) { setEditing(null); return }

    let body: Record<string, unknown> | null = null

    switch (field) {
      case 'nombre': {
        const v = draft.trim()
        if (v && v !== actividad.nombre) body = { nombre: v }
        break
      }
      case 'duracion': {
        const d = Math.max(1, parseInt(draft) || 1)
        if (d !== actividad.duracion) body = { duracion: d }
        break
      }
      case 'pctAvance': {
        const p = Math.max(0, Math.min(100, parseFloat(draft) || 0))
        if (p !== actividad.pctAvance) body = { pctAvance: p }
        break
      }
      case 'dependenciaId': {
        const depId = draft ? parseInt(draft) : null
        if (depId !== actividad.dependenciaId) body = { dependenciaId: depId }
        break
      }
      case 'tipoDependencia':
        if (draft !== actividad.tipoDependencia) body = { tipoDependencia: draft }
        break
      case 'desfaseDias': {
        const v = parseInt(draft) || 0
        if (v !== actividad.desfaseDias) body = { desfaseDias: v }
        break
      }
      case 'fechaInicio': {
        // Manual override: el servidor respeta fechaInicio+fechaFin juntos.
        // Calculamos fechaFin preservando la duración actual.
        if (!draft) break
        const nueva = new Date(draft + 'T00:00:00Z')
        if (isNaN(nueva.getTime())) break
        const diff = new Date(actividad.fechaFin).getTime() - new Date(actividad.fechaInicio).getTime()
        const nuevoFin = new Date(nueva.getTime() + diff)
        body = {
          fechaInicio: nueva.toISOString(),
          fechaFin: nuevoFin.toISOString(),
        }
        break
      }
      case 'fechaFin': {
        if (!draft) break
        const nueva = new Date(draft + 'T00:00:00Z')
        if (isNaN(nueva.getTime())) break
        body = {
          fechaInicio: new Date(actividad.fechaInicio).toISOString(),
          fechaFin: nueva.toISOString(),
        }
        break
      }
    }

    setEditing(null)
    if (body) await saveField(id, body)
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
    // Usa la fecha de hoy como default; el servidor calcula fechaFin desde duracion
    // tomando el calendario laboral del cronograma.
    try {
      const res = await fetch(`/api/cronograma/${cronogramaId}/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: 'Nueva actividad',
          duracion: 1,
          tipo: 'tarea',
          orden: ultimoOrden + 1,
          // no enviamos fechaInicio: el servidor usa cronograma.fechaInicio
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Error al crear actividad')
        return
      }
      const data = await res.json()
      router.refresh()
      // Dar foco al nombre para editar inmediatamente
      setTimeout(() => beginEdit(data.id, 'nombre', 'Nueva actividad'), 150)
    } catch (e) {
      console.error(e)
      alert('Error de red')
    }
  }

  // Reordenar: mueve una fila arriba o abajo y renumera el campo `orden`
  // de todas las actividades (base 1). Persistir solo las que cambiaron
  // garantiza que el nuevo orden gane sobre el tie-breaker por id, incluso
  // si todas venían con orden=0 por default.
  async function mover(id: number, dir: 'up' | 'down') {
    const idx = actividadesOrdenadas.findIndex(a => a.id === id)
    if (idx === -1) return
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= actividadesOrdenadas.length) return

    // Construir nuevo orden con el swap aplicado
    const nuevoOrden = [...actividadesOrdenadas]
    const [movida] = nuevoOrden.splice(idx, 1)
    nuevoOrden.splice(targetIdx, 0, movida)

    // Detectar cuáles cambian su `orden` esperado (posición + 1, base 1)
    const cambios = nuevoOrden
      .map((a, i) => ({ id: a.id, nuevoOrden: i + 1, prevOrden: a.orden ?? 0 }))
      .filter(c => c.nuevoOrden !== c.prevOrden)

    if (cambios.length === 0) return

    // Marcar todas como saving para feedback
    setSaving(s => {
      const n = new Set(s)
      cambios.forEach(c => n.add(c.id))
      return n
    })

    try {
      await Promise.all(cambios.map(c =>
        fetch(`/api/cronograma/${cronogramaId}/actividades/${c.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: c.nuevoOrden }),
        })
      ))
      router.refresh()
    } finally {
      setSaving(s => {
        const n = new Set(s)
        cambios.forEach(c => n.delete(c.id))
        return n
      })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  function fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })
  }

  // Numeración # basada en la posición en la lista ordenada (no el id de DB)
  const rowNumber = new Map<number, number>()
  actividadesOrdenadas.forEach((a, i) => rowNumber.set(a.id, i + 1))

  // Label de dependencia: "#3 - Nombre"
  function labelDep(a: Actividad): string {
    if (!a.dependenciaId) return '—'
    const pred = actividades.find(x => x.id === a.dependenciaId)
    if (!pred) return `#${a.dependenciaId}`
    const n = rowNumber.get(pred.id)
    return n ? `#${n} ${pred.nombre}` : pred.nombre
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Actividades ({actividadesOrdenadas.length})
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

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50 backdrop-blur z-10">
            <tr className="border-b border-border">
              <th className="w-8 text-center px-1 py-2 font-semibold text-muted-foreground">#</th>
              <th className="text-left px-2 py-2 font-semibold text-muted-foreground">Nombre</th>
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-14">Dur</th>
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-20">Inicio</th>
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-20">Fin</th>
              <th className="text-left px-2 py-2 font-semibold text-muted-foreground w-32">Depende de</th>
              {mostrarAvanzado && (
                <>
                  <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-16">Tipo</th>
                  <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-16">Desfase</th>
                </>
              )}
              <th className="text-center px-2 py-2 font-semibold text-muted-foreground w-14">%</th>
              <th className="w-14"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actividadesOrdenadas.length === 0 && (
              <tr><td colSpan={mostrarAvanzado ? 11 : 9} className="px-4 py-8 text-center text-muted-foreground">
                Sin actividades. Click en &ldquo;Nueva&rdquo; para agregar la primera.
              </td></tr>
            )}
            {actividadesOrdenadas.map((a, idx) => {
              const isSaving = saving.has(a.id)
              const n = rowNumber.get(a.id)
              return (
                <tr
                  key={a.id}
                  data-actividad-id={a.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    a.esCritica ? 'border-l-2 border-l-red-500' : ''
                  }`}
                >
                  {/* # row number */}
                  <td className="px-1 py-1 text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-muted/60 font-mono text-[10px] font-semibold text-foreground">
                      {n}
                    </span>
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
                        {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
                      </div>
                    )}
                  </td>

                  {/* Duración */}
                  <td className="px-1 py-1 text-center" onClick={() => beginEdit(a.id, 'duracion', a.duracion)}>
                    {editing?.id === a.id && editing.field === 'duracion' ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="number"
                        min={1}
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

                  {/* Inicio (editable — override manual) */}
                  <td className="px-1 py-1 text-center" onClick={() => beginEdit(a.id, 'fechaInicio', new Date(a.fechaInicio).toISOString().slice(0, 10))}>
                    {editing?.id === a.id && editing.field === 'fechaInicio' ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="date"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 border border-primary rounded text-xs bg-background"
                      />
                    ) : (
                      <span className="cursor-text tabular-nums">{fmtFecha(a.fechaInicio)}</span>
                    )}
                  </td>
                  {/* Fin (editable) */}
                  <td className="px-1 py-1 text-center" onClick={() => beginEdit(a.id, 'fechaFin', new Date(a.fechaFin).toISOString().slice(0, 10))}>
                    {editing?.id === a.id && editing.field === 'fechaFin' ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="date"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1 py-0.5 border border-primary rounded text-xs bg-background"
                      />
                    ) : (
                      <span className="cursor-text tabular-nums">{fmtFecha(a.fechaFin)}</span>
                    )}
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
                        {actividadesOrdenadas.filter(x => x.id !== a.id).map(x => {
                          const nx = rowNumber.get(x.id)
                          return <option key={x.id} value={x.id}>#{nx} {x.nombre}</option>
                        })}
                      </select>
                    ) : (
                      <span className="cursor-text truncate block text-[11px]">{labelDep(a)}</span>
                    )}
                  </td>

                  {/* Tipo dependencia (avanzado) */}
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

                  {/* Desfase (avanzado) */}
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

                  {/* Acciones: ↑ ↓ 🗑 */}
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-0.5 justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); mover(a.id, 'up') }}
                        disabled={idx === 0 || isSaving}
                        className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-30"
                        title="Subir"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); mover(a.id, 'down') }}
                        disabled={idx === actividadesOrdenadas.length - 1 || isSaving}
                        className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-30"
                        title="Bajar"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                        className="p-0.5 text-muted-foreground/40 hover:text-red-600 transition-colors"
                        title="Eliminar"
                        disabled={isSaving}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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
