'use client'

import { useState, useRef } from 'react'
import {
  Trash2, TrendingUp, ChevronDown, ChevronRight, Link2, Users,
  GripVertical, Diamond, Search, X, FolderPlus,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Actividad } from './CronogramaClient'

const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':    'bg-muted text-foreground border-border',
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

type EditableField = 'nombre' | 'duracion' | 'fechaInicio' | 'fechaFin' | 'pctAvance' | 'estado' | 'cuadrilla' | 'dependenciaId' | 'wbs' | 'capituloNombre'

function toDateInput(d: string | Date) { return new Date(d).toISOString().split('T')[0] }
function fmtFecha(d: string | Date) {
  return new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function wbsSegments(wbs: string) { return wbs.split('.').filter(Boolean) }
function wbsPrefix(wbs: string) {
  const segs = wbsSegments(wbs)
  return segs.length >= 3 ? segs.slice(0, segs.length - 1).join('.') : null
}
function wbsSort(a: string, b: string) {
  const segsA = wbsSegments(a).map(Number)
  const segsB = wbsSegments(b).map(Number)
  for (let i = 0; i < Math.max(segsA.length, segsB.length); i++) {
    const diff = (segsA[i] ?? 0) - (segsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// WBS solo se muestra si el usuario lo definió explícitamente.
// No auto-generamos códigos "1.1", "1.2" — confunde al usuario.
function computeWbsAuto(actividades: Actividad[]) {
  const map = new Map<number, string>()
  for (const a of actividades) {
    map.set(a.id, a.wbs ?? '')
  }
  return map
}

export function ActividadesTable({ actividades, onActualizar, onEliminar, onAbrirAvance }: Props) {
  // ── Filtros ────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<string | null>(null)
  const [filterCuadrilla, setFilterCuadrilla] = useState<string | null>(null)

  // ── Edición nombre de grupo ────────────────────────────────────
  const [editGrupo, setEditGrupo] = useState<string | null>(null) // capitulo actual
  const [editGrupoVal, setEditGrupoVal] = useState('')

  // ── Edición inline ─────────────────────────────────────────────
  const [editCell, setEditCell] = useState<{ id: number; field: EditableField } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [wbsError, setWbsError] = useState<string | null>(null)

  // ── Drag & drop ────────────────────────────────────────────────
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const dragCapitulo = useRef<string | null>(null)

  // ── Colapso ────────────────────────────────────────────────────
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  // ── Datos derivados ────────────────────────────────────────────
  const wbsAuto = computeWbsAuto(actividades)
  const cuadrillasList = [...new Set(actividades.map(a => a.cuadrilla).filter(Boolean))] as string[]
  const hayFiltro = search || filterEstado || filterCuadrilla

  const actsFiltradas = actividades.filter(a => {
    if (search && !a.nombre.toLowerCase().includes(search.toLowerCase()) &&
        !(a.wbs ?? wbsAuto.get(a.id) ?? '').includes(search)) return false
    if (filterEstado && a.estado !== filterEstado) return false
    if (filterCuadrilla && a.cuadrilla !== filterCuadrilla) return false
    return true
  })

  const grupos = new Map<string, Actividad[]>()
  for (const a of actsFiltradas) {
    const key = a.capituloNombre ?? 'General'
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(a)
  }

  // ── WBS validación duplicado ───────────────────────────────────
  // ── Renombrar capítulo ─────────────────────────────────────────
  function startEditGrupo(e: React.MouseEvent, capitulo: string) {
    e.stopPropagation()
    setEditGrupo(capitulo)
    setEditGrupoVal(capitulo)
  }

  async function saveGrupo(capitulo: string) {
    const newName = editGrupoVal.trim() || capitulo
    setEditGrupo(null)
    if (newName === capitulo) return
    const actsGrupo = actividades.filter(a => (a.capituloNombre ?? 'General') === capitulo)
    await Promise.all(actsGrupo.map(a => onActualizar(a.id, { capituloNombre: newName } as Partial<Actividad>)))
  }

  // ── WBS validación duplicado ───────────────────────────────────
  function isDuplicateWbs(actId: number, wbs: string) {
    if (!wbs) return false
    return actividades.some(a => a.id !== actId && a.wbs === wbs)
  }

  // ── Edición inline ─────────────────────────────────────────────
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
    else if (field === 'capituloNombre') val = a.capituloNombre ?? ''
    else if (field === 'dependenciaId') val = a.dependenciaId ? String(a.dependenciaId) : ''
    setWbsError(null)
    setEditCell({ id: a.id, field })
    setEditValue(val)
  }

  async function commitEdit(a: Actividad) {
    if (!editCell || editCell.id !== a.id) return
    const { field } = editCell
    if (field === 'wbs' && isDuplicateWbs(a.id, editValue)) {
      setWbsError(`WBS "${editValue}" ya está en uso`)
      return
    }
    let data: Partial<Actividad> = {}
    if (field === 'nombre') data = { nombre: editValue }
    else if (field === 'duracion') data = { duracion: Math.max(1, parseInt(editValue) || 1) }
    else if (field === 'fechaInicio') data = { fechaInicio: editValue }
    else if (field === 'fechaFin') data = { fechaFin: editValue }
    else if (field === 'pctAvance') data = { pctAvance: Math.min(100, Math.max(0, parseFloat(editValue) || 0)) }
    else if (field === 'estado') data = { estado: editValue }
    else if (field === 'cuadrilla') data = { cuadrilla: editValue || null }
    else if (field === 'wbs') data = { wbs: editValue || null }
    else if (field === 'capituloNombre') data = { capituloNombre: editValue || null } as Partial<Actividad>
    else if (field === 'dependenciaId') data = { dependenciaId: editValue ? parseInt(editValue) : null }
    setEditCell(null); setWbsError(null)
    await onActualizar(a.id, data)
  }

  function cancelEdit() { setEditCell(null); setWbsError(null) }
  function isEditing(id: number, field: EditableField) { return editCell?.id === id && editCell?.field === field }

  // ── Drag & drop ────────────────────────────────────────────────
  function handleDragStart(a: Actividad, cap: string) { setDragId(a.id); dragCapitulo.current = cap }
  function handleDragOver(e: React.DragEvent, _a: Actividad, _cap: string) {
    e.preventDefault()
    setDragOverId(_a.id)
  }
  async function handleDrop(e: React.DragEvent, target: Actividad, cap: string) {
    e.preventDefault()
    if (!dragId || dragId === target.id) {
      setDragId(null); setDragOverId(null); return
    }
    const sourceCap = dragCapitulo.current
    if (sourceCap === cap) {
      // Same group — reorder only
      const grupo = grupos.get(cap) ?? []
      const oldIdx = grupo.findIndex(a => a.id === dragId)
      const newIdx = grupo.findIndex(a => a.id === target.id)
      if (oldIdx === -1 || newIdx === -1) { setDragId(null); setDragOverId(null); return }
      const reord = [...grupo]; const [moved] = reord.splice(oldIdx, 1); reord.splice(newIdx, 0, moved)
      setDragId(null); setDragOverId(null)
      await Promise.all(reord.map((a, idx) => a.orden !== idx ? onActualizar(a.id, { orden: idx }) : Promise.resolve()))
    } else {
      // Cross-group — move to target group at target position
      const targetGrupo = [...(grupos.get(cap) ?? [])]
      const targetIdx = targetGrupo.findIndex(a => a.id === target.id)
      const newCapitulo = cap === 'General' ? null : cap
      setDragId(null); setDragOverId(null)
      const updates: Promise<void>[] = []
      // Update dragged item: change group + set order at insertion point
      updates.push(onActualizar(dragId, { capituloNombre: newCapitulo, orden: targetIdx } as Partial<Actividad>))
      // Shift items after insertion point
      for (let i = targetIdx; i < targetGrupo.length; i++) {
        updates.push(onActualizar(targetGrupo[i].id, { orden: i + 1 }))
      }
      await Promise.all(updates)
    }
  }

  function toggleColapso(key: string) {
    setColapsados(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── Sub-agrupación WBS ─────────────────────────────────────────
  type RowItem =
    | { type: 'subgroup'; prefix: string; acts: Actividad[]; capitulo: string }
    | { type: 'task'; act: Actividad; capitulo: string; indented: boolean }

  function buildRows(acts: Actividad[], capitulo: string): RowItem[] {
    // Ordenar por WBS numérico
    const sorted = [...acts].sort((a, b) =>
      wbsSort(a.wbs ?? wbsAuto.get(a.id) ?? '', b.wbs ?? wbsAuto.get(b.id) ?? '')
    )

    // Detectar sub-grupos: prefijos comunes en WBS de 3+ segmentos
    const subGroupMap = new Map<string, Actividad[]>()
    for (const a of sorted) {
      const prefix = wbsPrefix(a.wbs ?? wbsAuto.get(a.id) ?? '')
      if (prefix) {
        if (!subGroupMap.has(prefix)) subGroupMap.set(prefix, [])
        subGroupMap.get(prefix)!.push(a)
      }
    }

    const rows: RowItem[] = []
    const seenPrefixes = new Set<string>()

    for (const a of sorted) {
      const w = a.wbs ?? wbsAuto.get(a.id) ?? ''
      const prefix = wbsPrefix(w)
      if (prefix) {
        if (!seenPrefixes.has(prefix)) {
          seenPrefixes.add(prefix)
          rows.push({ type: 'subgroup', prefix, acts: subGroupMap.get(prefix)!, capitulo })
        }
        // la tarea se renderiza dentro del sub-grupo, no aquí
      } else {
        rows.push({ type: 'task', act: a, capitulo, indented: false })
      }
    }
    return rows
  }

  // ── Celdas editables ───────────────────────────────────────────
  function CeldaTexto({ a, field, display, className = '' }: {
    a: Actividad; field: EditableField; display: React.ReactNode; className?: string
  }) {
    if (isEditing(a.id, field)) {
      return (
        <div>
          <input autoFocus value={editValue} onChange={e => { setEditValue(e.target.value); setWbsError(null) }}
            onBlur={() => commitEdit(a)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(a); if (e.key === 'Escape') cancelEdit() }}
            className={`w-full h-7 px-1.5 text-sm border rounded bg-background focus:outline-none ${wbsError && field === 'wbs' ? 'border-red-500' : 'border-primary'} ${className}`}
          />
          {field === 'wbs' && wbsError && (
            <p className="text-xs text-red-500 mt-0.5">{wbsError}</p>
          )}
        </div>
      )
    }
    return (
      <div onClick={() => startEdit(a, field)}
        className="cursor-text min-h-[28px] flex items-center hover:bg-muted/40 rounded px-1 -mx-1 transition-colors" title="Clic para editar">
        {display}
      </div>
    )
  }

  function CeldaFecha({ a, field, display }: { a: Actividad; field: EditableField; display: string }) {
    if (isEditing(a.id, field)) {
      return <input autoFocus type="date" value={editValue} onChange={e => setEditValue(e.target.value)}
        onBlur={() => commitEdit(a)}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(a); if (e.key === 'Escape') cancelEdit() }}
        className="w-full h-7 px-1 text-xs border border-primary rounded bg-background focus:outline-none" />
    }
    return (
      <div onClick={() => startEdit(a, field)}
        className="cursor-text text-sm text-muted-foreground tabular-nums min-h-[28px] flex items-center hover:bg-muted/40 rounded px-1 -mx-1 transition-colors" title="Clic para editar">
        {display}
      </div>
    )
  }

  function CeldaEstado({ a }: { a: Actividad }) {
    if (isEditing(a.id, 'estado')) {
      return <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
        onBlur={() => commitEdit(a)} onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
        className="h-7 text-xs border border-primary rounded px-1 bg-background focus:outline-none w-full">
        {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    }
    return (
      <div onClick={() => startEdit(a, 'estado')} className="cursor-pointer" title="Clic para cambiar estado">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80 ${ESTADO_COLORS[a.estado] ?? 'bg-muted text-muted-foreground border-border'}`}>
          {a.estado}
        </span>
      </div>
    )
  }

  function CeldaDependencia({ a }: { a: Actividad }) {
    if (isEditing(a.id, 'dependenciaId')) {
      return <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
        onBlur={() => commitEdit(a)} onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
        className="h-6 text-xs border border-primary rounded px-1 bg-background focus:outline-none w-full">
        <option value="">Sin dependencia</option>
        {actividades.filter(x => x.id !== a.id).map(x => (
          <option key={x.id} value={x.id}>{wbsAuto.get(x.id) || ''} {x.nombre}</option>
        ))}
      </select>
    }
    return (
      <div className="mt-0.5 space-y-0.5">
        <div onClick={() => startEdit(a, 'dependenciaId')}
          className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors" title="Clic para asignar predecesora">
          {a.dependencia
            ? <><Link2 className="w-3 h-3 shrink-0" />{a.dependencia.nombre}</>
            : <span className="text-muted-foreground/40 italic">+ dependencia</span>}
        </div>
        {a.dependenciaId && (
          <div className="flex items-center gap-1 text-[10px]">
            <select
              value={a.tipoDependencia}
              onChange={e => onActualizar(a.id, { tipoDependencia: e.target.value })}
              className="h-5 border border-border rounded px-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring text-[10px]"
              title="Tipo PDM: FS=Fin-Inicio, SS=Inicio-Inicio, FF=Fin-Fin, SF=Inicio-Fin"
            >
              <option value="FS">FS</option>
              <option value="SS">SS</option>
              <option value="FF">FF</option>
              <option value="SF">SF</option>
            </select>
            <span className="text-muted-foreground">+</span>
            <input
              type="number"
              value={a.desfaseDias ?? 0}
              onChange={e => onActualizar(a.id, { desfaseDias: parseInt(e.target.value) || 0 })}
              className="h-5 w-10 border border-border rounded px-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring text-[10px]"
              title="Desfase en días (positivo=espera, negativo=adelanto)"
            />
            <span className="text-muted-foreground">d</span>
          </div>
        )}
      </div>
    )
  }

  // ── Render fila de actividad ───────────────────────────────────
  function FilaActividad({ a, capitulo, indented = false }: { a: Actividad; capitulo: string; indented?: boolean }) {
    return (
      <tr
        draggable
        onDragStart={() => handleDragStart(a, capitulo)}
        onDragOver={e => handleDragOver(e, a, capitulo)}
        onDrop={e => handleDrop(e, a, capitulo)}
        onDragEnd={() => { setDragId(null); setDragOverId(null) }}
        className={`transition-colors ${
          dragId === a.id ? 'opacity-40' :
          dragOverId === a.id ? 'bg-blue-50 dark:bg-blue-900/20 border-t-2 border-t-blue-400' :
          'hover:bg-muted/20'
        }`}
      >
        <td className="w-8 px-1 text-center cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground/40 mx-auto" />
        </td>
        {/* WBS */}
        <td className={`px-3 py-2 ${indented ? 'pl-8' : ''}`}>
          <CeldaTexto a={a} field="wbs" className="w-16 font-mono" display={
            <span className="text-xs font-mono font-semibold text-muted-foreground tabular-nums">
              {wbsAuto.get(a.id)}
            </span>
          } />
        </td>
        {/* Nombre */}
        <td className={`px-3 py-2 ${indented ? 'pl-6' : 'pl-7'}`}>
          <CeldaTexto a={a} field="nombre" display={
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {a.tipo === 'hito' && <Diamond className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              {a.nombre}
            </span>
          } />
          <CeldaDependencia a={a} />
          {/* Capítulo editable — para mover la tarea entre grupos */}
          <datalist id={`caps-${a.id}`}>
            {Array.from(new Set(actividades.map(x => x.capituloNombre ?? 'General'))).map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {isEditing(a.id, 'capituloNombre') ? (
            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitEdit(a)}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(a); if (e.key === 'Escape') cancelEdit() }}
              className="mt-1 h-5 px-1.5 text-xs border border-primary rounded bg-background focus:outline-none w-36"
              placeholder="Nombre del capítulo" list={`caps-${a.id}`}
            />
          ) : (
            <span
              onClick={() => startEdit(a, 'capituloNombre')}
              className="inline-block mt-0.5 text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer italic"
              title="Clic para cambiar de grupo"
            >
              {a.capituloNombre ?? 'General'}
            </span>
          )}
        </td>
        {/* Días */}
        <td className="px-3 py-2 text-center">
          {a.tipo !== 'hito' ? (
            <CeldaTexto a={a} field="duracion" className="text-center w-12" display={
              <span className="text-sm text-muted-foreground w-full text-center">{a.duracion}d</span>
            } />
          ) : <span className="text-xs text-amber-500 font-semibold">hito</span>}
        </td>
        {/* Fechas */}
        <td className="px-3 py-2"><CeldaFecha a={a} field="fechaInicio" display={fmtFecha(a.fechaInicio)} /></td>
        <td className="px-3 py-2"><CeldaFecha a={a} field="fechaFin" display={fmtFecha(a.fechaFin)} /></td>
        {/* Avance */}
        <td className="px-3 py-2">
          {a.tipo !== 'hito' ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${a.pctAvance >= 100 ? 'bg-green-500' : a.estado === 'Atrasado' ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${a.pctAvance}%` }} />
              </div>
              <CeldaTexto a={a} field="pctAvance" className="text-right w-10" display={
                <span className="text-xs font-bold text-foreground w-8 text-right tabular-nums">{a.pctAvance.toFixed(0)}%</span>
              } />
            </div>
          ) : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
        {/* Estado */}
        <td className="px-3 py-2"><CeldaEstado a={a} /></td>
        {/* Cuadrilla */}
        <td className="px-3 py-2">
          <CeldaTexto a={a} field="cuadrilla" display={
            a.cuadrilla
              ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3 h-3" />{a.cuadrilla}</span>
              : <span className="text-xs text-muted-foreground/40 italic">+ cuadrilla</span>
          } />
        </td>
        {/* Acciones */}
        <td className="px-3 py-2">
          <div className="flex justify-end gap-1">
            <button onClick={() => onAbrirAvance(a)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-blue-50 rounded" title="Registrar avance">
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onEliminar(a.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* Barra de filtros */}
      <div className="px-4 py-3 border-b border-border bg-muted/10 flex flex-wrap items-center gap-2">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-40 max-w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar actividad..."
            className="w-full h-8 pl-8 pr-3 text-xs border border-border rounded-lg bg-background focus:outline-none focus:border-primary" />
        </div>

        {/* Filtro estado */}
        <div className="flex items-center gap-1 flex-wrap">
          {ESTADOS.map(e => (
            <button key={e} onClick={() => setFilterEstado(filterEstado === e ? null : e)}
              className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                filterEstado === e
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:bg-muted'
              }`}>
              {e}
            </button>
          ))}
        </div>

        {/* Filtro cuadrilla */}
        {cuadrillasList.length > 0 && (
          <div className="flex items-center gap-1">
            {cuadrillasList.map(c => (
              <button key={c} onClick={() => setFilterCuadrilla(filterCuadrilla === c ? null : c)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border font-medium transition-colors ${
                  filterCuadrilla === c
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border hover:bg-muted'
                }`}>
                <Users className="w-3 h-3" />{c}
              </button>
            ))}
          </div>
        )}

        {/* Limpiar filtros */}
        {hayFiltro && (
          <button onClick={() => { setSearch(''); setFilterEstado(null); setFilterCuadrilla(null) }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}

        {hayFiltro && (
          <span className="text-xs text-muted-foreground ml-auto">
            {actsFiltradas.length} de {actividades.length} actividades
          </span>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="w-8" />
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
          {actsFiltradas.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {hayFiltro ? 'Sin resultados para los filtros aplicados.' : 'Sin actividades. Agrega una o genera desde un presupuesto.'}
              </td>
            </tr>
          )}

          {Array.from(grupos.entries()).map(([capitulo, acts]) => {
            const colapsado = colapsados.has(`cap-${capitulo}`)
            const pctGrupo = Math.round(acts.reduce((s, a) => s + a.pctAvance, 0) / acts.length || 0)
            const grupoWbs = acts[0] ? wbsAuto.get(acts[0].id)?.split('.')[0] : ''
            const rows = buildRows(acts, capitulo)

            return [
              // ── Fila capítulo ──────────────────────────────────
              <tr key={`cap-${capitulo}`} className="bg-muted/30 cursor-pointer select-none border-t-2 border-border/40"
                onClick={() => toggleColapso(`cap-${capitulo}`)}>
                <td className="px-2 py-2 text-center">
                  {colapsado ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                </td>
                <td className="px-3 py-2 text-xs font-bold text-muted-foreground">{grupoWbs}</td>
                <td className="px-3 py-2" colSpan={4}>
                  {editGrupo === capitulo ? (
                    <input
                      autoFocus
                      value={editGrupoVal}
                      onChange={e => setEditGrupoVal(e.target.value)}
                      onBlur={() => saveGrupo(capitulo)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') saveGrupo(capitulo); if (e.key === 'Escape') setEditGrupo(null) }}
                      onClick={e => e.stopPropagation()}
                      className="h-7 px-2 text-xs font-bold border border-primary rounded bg-background focus:outline-none uppercase tracking-wide w-48"
                    />
                  ) : (
                    <>
                      <span
                        className="text-xs font-bold text-foreground uppercase tracking-wide hover:text-primary cursor-text border-b border-dashed border-transparent hover:border-primary transition-colors"
                        onClick={e => startEditGrupo(e, capitulo)}
                        title="Clic para renombrar grupo"
                      >{capitulo}</span>
                      <span className="text-xs text-muted-foreground ml-2">({acts.length} actividades)</span>
                    </>
                  )}
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

              // ── Filas actividades / sub-grupos ─────────────────
              ...(!colapsado ? rows.flatMap(row => {
                if (row.type === 'task') {
                  return [<FilaActividad key={row.act.id} a={row.act} capitulo={capitulo} indented={row.indented} />]
                }

                // Sub-grupo
                const sgKey = `sg-${row.prefix}`
                const colSg = colapsados.has(sgKey)
                const pctSg = Math.round(row.acts.reduce((s, a) => s + a.pctAvance, 0) / row.acts.length || 0)
                return [
                  <tr key={sgKey} className="bg-muted/15 cursor-pointer select-none"
                    onClick={() => toggleColapso(sgKey)}>
                    <td className="px-2 py-1.5 text-center">
                      {colSg ? <ChevronRight className="w-3 h-3 text-muted-foreground mx-auto" />
                               : <ChevronDown className="w-3 h-3 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="text-xs font-bold text-muted-foreground font-mono">{row.prefix}</span>
                    </td>
                    <td className="px-3 py-1.5 pl-6" colSpan={4}>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
                        Sub-grupo {row.prefix}
                        <span className="text-muted-foreground font-normal">({row.acts.length})</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="text-xs font-bold text-foreground">{pctSg}%</span>
                    </td>
                    <td colSpan={3} className="px-3 py-1.5">
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pctSg}%` }} />
                      </div>
                    </td>
                  </tr>,
                  ...(!colSg ? row.acts.map(a =>
                    <FilaActividad key={a.id} a={a} capitulo={capitulo} indented />
                  ) : []),
                ]
              }) : []),
            ]
          })}
        </tbody>
      </table>

      <p className="px-4 py-2 text-xs text-muted-foreground/60 border-t border-border bg-muted/10 flex items-center gap-1">
        Arrastra <GripVertical className="inline w-3 h-3" /> para reordenar (entre grupos también) · Clic en celda para editar · Clic en nombre de grupo bajo la tarea para moverla
      </p>
    </div>
  )
}
