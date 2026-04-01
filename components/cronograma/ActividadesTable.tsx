'use client'

import { useState, useRef } from 'react'
import { Trash2, TrendingUp, ChevronDown, ChevronRight, Link2, Users, GripVertical, Diamond } from 'lucide-react'
import type { Actividad } from './CronogramaClient'

const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':    'bg-slate-100 text-slate-700 border-slate-200',
  'En Ejecución': 'bg-blue-100 text-blue-700 border-blue-200',
  'Completado':   'bg-green-100 text-green-700 border-green-200',
  'Atrasado':     'bg-red-100 text-red-700 border-red-200',
}

const ESTADOS = ['Pendiente', 'En Ejecución', 'Completado', 'Atrasado']

interface Props {
  actividades: Actividad[]
  onActualizar: (id: number, data: Partial<Actividad>) => Promise<void>
  onEliminar: (id: number) => Promise<void>
  onAbrirAvance: (a: Actividad) => void
}

type EditableField = 'nombre' | 'duracion' | 'fechaInicio' | 'fechaFin' | 'pctAvance' | 'estado' | 'cuadrilla' | 'dependenciaId' | 'wbs'

function toDateInput(d: string | Date) {
  return new Date(d).toISOString().split('T')[0]
}
function fmtFecha(d: string | Date) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function ActividadesTable({ actividades, onActualizar, onEliminar, onAbrirAvance }: Props) {
  // ── Estado edición inline ──────────────────────────────────────
  const [editCell, setEditCell] = useState<{ id: number; field: EditableField } | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // ── Estado drag & drop ─────────────────────────────────────────
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const dragCapitulo = useRef<string | null>(null)

  // ── Colapso de grupos ──────────────────────────────────────────
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  // Agrupar por capítulo
  const grupos = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const key = a.capituloNombre ?? 'General'
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(a)
  }

  // ── Helpers edición inline ─────────────────────────────────────
  function startEdit(a: Actividad, field: EditableField) {
    let val = ''
    if (field === 'nombre') val = a.nombre
    else if (field === 'duracion') val = String(a.duracion)
    else if (field === 'fechaInicio') val = toDateInput(a.fechaInicio)
    else if (field === 'fechaFin') val = toDateInput(a.fechaFin)
    else if (field === 'pctAvance') val = String(a.pctAvance)
    else if (field === 'estado') val = a.estado
    else if (field === 'cuadrilla') val = a.cuadrilla ?? ''
    else if (field === 'wbs') val = a.wbs ?? ''
    else if (field === 'dependenciaId') val = a.dependenciaId ? String(a.dependenciaId) : ''
    setEditCell({ id: a.id, field })
    setEditValue(val)
  }

  async function commitEdit(a: Actividad) {
    if (!editCell || editCell.id !== a.id) return
    const { field } = editCell
    let data: Partial<Actividad> = {}
    if (field === 'nombre') data = { nombre: editValue }
    else if (field === 'duracion') data = { duracion: Math.max(1, parseInt(editValue) || 1) }
    else if (field === 'fechaInicio') data = { fechaInicio: editValue }
    else if (field === 'fechaFin') data = { fechaFin: editValue }
    else if (field === 'pctAvance') data = { pctAvance: Math.min(100, Math.max(0, parseFloat(editValue) || 0)) }
    else if (field === 'estado') data = { estado: editValue }
    else if (field === 'cuadrilla') data = { cuadrilla: editValue || null }
    else if (field === 'wbs') data = { wbs: editValue || null }
    else if (field === 'dependenciaId') data = { dependenciaId: editValue ? parseInt(editValue) : null }
    setEditCell(null)
    await onActualizar(a.id, data)
  }

  function cancelEdit() { setEditCell(null) }

  function isEditing(id: number, field: EditableField) {
    return editCell?.id === id && editCell?.field === field
  }

  // ── Helpers drag & drop ────────────────────────────────────────
  function handleDragStart(a: Actividad, capitulo: string) {
    setDragId(a.id)
    dragCapitulo.current = capitulo
  }

  function handleDragOver(e: React.DragEvent, a: Actividad, capitulo: string) {
    e.preventDefault()
    if (capitulo !== dragCapitulo.current) return
    setDragOverId(a.id)
  }

  async function handleDrop(e: React.DragEvent, targetA: Actividad, capitulo: string) {
    e.preventDefault()
    if (!dragId || capitulo !== dragCapitulo.current || dragId === targetA.id) {
      setDragId(null); setDragOverId(null); return
    }
    const grupo = grupos.get(capitulo) ?? []
    const oldIdx = grupo.findIndex(a => a.id === dragId)
    const newIdx = grupo.findIndex(a => a.id === targetA.id)
    if (oldIdx === -1 || newIdx === -1) { setDragId(null); setDragOverId(null); return }

    // Reordenar localmente y persistir
    const reordenado = [...grupo]
    const [moved] = reordenado.splice(oldIdx, 1)
    reordenado.splice(newIdx, 0, moved)
    setDragId(null); setDragOverId(null)

    // Actualizar orden de los afectados
    await Promise.all(
      reordenado.map((a, idx) =>
        a.orden !== idx ? onActualizar(a.id, { orden: idx }) : Promise.resolve()
      )
    )
  }

  function toggleGrupo(key: string) {
    setColapsados(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  // ── Render celda editable ──────────────────────────────────────
  function CeldaTexto({ a, field, display, className = '' }: {
    a: Actividad; field: EditableField; display: React.ReactNode; className?: string
  }) {
    if (isEditing(a.id, field)) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit(a)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(a); if (e.key === 'Escape') cancelEdit() }}
          className={`w-full h-7 px-1.5 text-sm border border-primary rounded bg-background focus:outline-none ${className}`}
        />
      )
    }
    return (
      <div
        onClick={() => startEdit(a, field)}
        className="cursor-text min-h-[28px] flex items-center hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
        title="Clic para editar"
      >
        {display}
      </div>
    )
  }

  function CeldaFecha({ a, field, display }: { a: Actividad; field: EditableField; display: string }) {
    if (isEditing(a.id, field)) {
      return (
        <input
          autoFocus
          type="date"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit(a)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(a); if (e.key === 'Escape') cancelEdit() }}
          className="w-full h-7 px-1 text-xs border border-primary rounded bg-background focus:outline-none"
        />
      )
    }
    return (
      <div
        onClick={() => startEdit(a, field)}
        className="cursor-text text-sm text-muted-foreground tabular-nums min-h-[28px] flex items-center hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
        title="Clic para editar"
      >
        {display}
      </div>
    )
  }

  function CeldaEstado({ a }: { a: Actividad }) {
    if (isEditing(a.id, 'estado')) {
      return (
        <select
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit(a)}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
          className="h-7 text-xs border border-primary rounded px-1 bg-background focus:outline-none w-full"
        >
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    }
    return (
      <div onClick={() => startEdit(a, 'estado')} className="cursor-pointer" title="Clic para cambiar estado">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80 transition-opacity ${ESTADO_COLORS[a.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {a.estado}
        </span>
      </div>
    )
  }

  function CeldaDependencia({ a }: { a: Actividad }) {
    if (isEditing(a.id, 'dependenciaId')) {
      return (
        <select
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit(a)}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
          className="h-6 text-xs border border-primary rounded px-1 bg-background focus:outline-none w-full"
        >
          <option value="">Sin dependencia</option>
          {actividades.filter(x => x.id !== a.id).map(x => (
            <option key={x.id} value={x.id}>{x.nombre}</option>
          ))}
        </select>
      )
    }
    return (
      <div
        onClick={() => startEdit(a, 'dependenciaId')}
        className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        title="Clic para asignar dependencia"
      >
        {a.dependencia
          ? <><Link2 className="w-3 h-3 shrink-0" />{a.tipoDependencia}: {a.dependencia.nombre}</>
          : <span className="text-muted-foreground/40 italic">+ dependencia</span>
        }
      </div>
    )
  }

  // Auto-generar WBS si la tarea no tiene uno asignado
  const wbsAuto = new Map<number, string>()
  let gIdx = 1
  for (const [, acts] of grupos.entries()) {
    acts.forEach((a, tIdx) => { wbsAuto.set(a.id, a.wbs ?? `${gIdx}.${tIdx + 1}`) })
    gIdx++
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="w-8"></th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-16">WBS</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Actividad</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase w-14">Días</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-24">Inicio</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-24">Fin</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase w-20">Avance</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Estado</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Cuadrilla</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase w-20">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {actividades.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                Sin actividades. Agrega una o genera desde un presupuesto.
              </td>
            </tr>
          )}

          {Array.from(grupos.entries()).map(([capitulo, acts]) => {
            const colapsado = colapsados.has(capitulo)
            const pctGrupo = Math.round(acts.reduce((s, a) => s + a.pctAvance, 0) / acts.length)

            return [
              // ── Fila grupo ───────────────────────────────────────
              <tr key={`g-${capitulo}`} className="bg-muted/20 cursor-pointer select-none" onClick={() => toggleGrupo(capitulo)}>
                <td className="px-2 py-2 text-center">
                  {colapsado
                    ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-muted-foreground">
                  {acts[0] ? wbsAuto.get(acts[0].id)?.split('.')[0] : ''}
                </td>
                <td className="px-3 py-2" colSpan={4}>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">{capitulo}</span>
                  <span className="text-xs text-muted-foreground ml-2">({acts.length} actividades)</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="text-xs font-bold text-foreground">{pctGrupo}%</span>
                </td>
                <td colSpan={3} className="px-3 py-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctGrupo}%` }} />
                  </div>
                </td>
              </tr>,

              // ── Filas actividades ────────────────────────────────
              ...(!colapsado ? acts.map(a => (
                <tr
                  key={a.id}
                  draggable
                  onDragStart={() => handleDragStart(a, capitulo)}
                  onDragOver={e => handleDragOver(e, a, capitulo)}
                  onDrop={e => handleDrop(e, a, capitulo)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                  className={`transition-colors ${
                    dragId === a.id ? 'opacity-40' :
                    dragOverId === a.id && dragCapitulo.current === capitulo ? 'bg-blue-50 dark:bg-blue-900/20 border-t-2 border-t-blue-400' :
                    'hover:bg-muted/20'
                  }`}
                >
                  {/* Handle drag */}
                  <td className="w-8 px-1 text-center cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                  </td>

                  {/* WBS */}
                  <td className="px-3 py-2.5">
                    <CeldaTexto a={a} field="wbs" className="w-16 font-mono" display={
                      <span className="text-xs font-mono font-semibold text-muted-foreground tabular-nums">
                        {wbsAuto.get(a.id)}
                      </span>
                    } />
                  </td>

                  {/* Nombre + dependencia */}
                  <td className="px-3 py-2.5 pl-7">
                    <CeldaTexto a={a} field="nombre" display={
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {a.tipo === 'hito' && <Diamond className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {a.nombre}
                      </span>
                    } />
                    <CeldaDependencia a={a} />
                  </td>

                  {/* Días */}
                  <td className="px-3 py-2.5 text-center">
                    <CeldaTexto a={a} field="duracion" className="text-center w-12" display={
                      <span className="text-sm text-muted-foreground w-full text-center">{a.duracion}d</span>
                    } />
                  </td>

                  {/* Fecha inicio */}
                  <td className="px-3 py-2.5">
                    <CeldaFecha a={a} field="fechaInicio" display={fmtFecha(a.fechaInicio)} />
                  </td>

                  {/* Fecha fin */}
                  <td className="px-3 py-2.5">
                    <CeldaFecha a={a} field="fechaFin" display={fmtFecha(a.fechaFin)} />
                  </td>

                  {/* Avance */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${a.pctAvance >= 100 ? 'bg-green-500' : a.estado === 'Atrasado' ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${a.pctAvance}%` }} />
                      </div>
                      <CeldaTexto a={a} field="pctAvance" className="text-right w-10" display={
                        <span className="text-xs font-bold text-foreground w-8 text-right tabular-nums">{a.pctAvance.toFixed(0)}%</span>
                      } />
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-3 py-2.5">
                    <CeldaEstado a={a} />
                  </td>

                  {/* Cuadrilla */}
                  <td className="px-3 py-2.5">
                    <CeldaTexto a={a} field="cuadrilla" display={
                      a.cuadrilla
                        ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3 h-3" />{a.cuadrilla}</span>
                        : <span className="text-xs text-muted-foreground/40 italic">+ cuadrilla</span>
                    } />
                  </td>

                  {/* Acciones */}
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => onAbrirAvance(a)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded" title="Registrar avance">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onEliminar(a.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : []),
            ]
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted-foreground/60 border-t border-border bg-muted/10 flex items-center gap-1">
        Arrastra <GripVertical className="inline w-3 h-3" /> para reordenar · Clic en cualquier celda para editar · WBS auto-generado si está vacío
      </p>
    </div>
  )
}
