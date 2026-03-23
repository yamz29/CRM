'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import { AlertTriangle, Pencil, List, Columns, X } from 'lucide-react'
import { DeleteTareaButton } from '@/app/tareas/DeleteTareaButton'

interface Tarea {
  id: number
  titulo: string
  descripcion: string | null
  estado: string
  prioridad: string
  fechaLimite: string | Date | null
  responsable: string | null
  cliente: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string } | null
  asignado: { id: number; nombre: string } | null
}

interface Props {
  tareas: Tarea[]
  usuarios: { id: number; nombre: string }[]
}

const ESTADOS = ['Pendiente', 'En proceso', 'Completada', 'Cancelada']
const KANBAN_COLS = [
  { estado: 'Pendiente',   label: 'Por hacer',   color: 'border-slate-300 bg-slate-50',  badge: 'bg-slate-200 text-slate-700' },
  { estado: 'En proceso',  label: 'En progreso', color: 'border-blue-300 bg-blue-50',    badge: 'bg-blue-200 text-blue-700' },
  { estado: 'Completada',  label: 'Completado',  color: 'border-green-300 bg-green-50',  badge: 'bg-green-200 text-green-700' },
  { estado: 'Cancelada',   label: 'Cancelada',   color: 'border-red-200 bg-red-50',      badge: 'bg-red-200 text-red-700' },
]

function getPrioridadBadge(prioridad: string) {
  const map: Record<string, 'danger' | 'warning' | 'success'> = { Alta: 'danger', Media: 'warning', Baja: 'success' }
  return <Badge variant={map[prioridad] ?? 'default' as any}>{prioridad}</Badge>
}

function getEstadoBadge(estado: string) {
  const map: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
    Pendiente: 'default', 'En proceso': 'info', Completada: 'success', Cancelada: 'danger',
  }
  return <Badge variant={map[estado] ?? 'default'}>{estado}</Badge>
}

export function TareasPageClient({ tareas, usuarios }: Props) {
  const router = useRouter()
  const today = new Date()
  const [view, setView] = useState<'lista' | 'kanban'>('lista')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAsignado, setFiltroAsignado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')

  // DnD state
  const draggingId = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const filtered = tareas.filter((t) => {
    if (filtroEstado && t.estado !== filtroEstado) return false
    if (filtroAsignado && String(t.asignado?.id ?? '') !== filtroAsignado) return false
    if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false
    return true
  })

  const isVencida = (t: Tarea) =>
    t.fechaLimite &&
    new Date(t.fechaLimite) < today &&
    !['Completada', 'Cancelada'].includes(t.estado)

  const hasFilters = filtroEstado || filtroAsignado || filtroPrioridad

  // ── Drag & Drop ──────────────────────────────────────────────────────
  async function handleDrop(nuevoEstado: string) {
    const id = draggingId.current
    if (!id) return
    setDragOver(null)
    draggingId.current = null
    await fetch(`/api/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado, _patch: true }),
    })
    router.refresh()
  }

  // ── Tarjeta Kanban ───────────────────────────────────────────────────
  function KanbanCard({ tarea }: { tarea: Tarea }) {
    const vencida = isVencida(tarea)
    return (
      <div
        draggable
        onDragStart={() => { draggingId.current = tarea.id }}
        className={`bg-white border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing select-none
          ${vencida ? 'border-red-300' : 'border-slate-200'} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{tarea.titulo}</p>
          {vencida && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
        </div>
        {tarea.descripcion && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">{tarea.descripcion}</p>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {getPrioridadBadge(tarea.prioridad)}
          {tarea.asignado && (
            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
              {tarea.asignado.nombre.split(' ')[0]}
            </span>
          )}
        </div>
        {tarea.fechaLimite && (
          <p className={`text-xs mt-1.5 ${vencida ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
            {formatDate(new Date(tarea.fechaLimite))}
          </p>
        )}
        <div className="flex gap-1 mt-2 pt-2 border-t border-slate-100">
          <Link href={`/tareas/${tarea.id}/editar`}>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Pencil className="w-3 h-3" />
            </Button>
          </Link>
          <DeleteTareaButton id={tarea.id} titulo={tarea.titulo} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* View toggle + Filtros */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle vista */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => setView('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors
                  ${view === 'lista' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors
                  ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <Columns className="w-3.5 h-3.5" /> Kanban
              </button>
            </div>

            <div className="w-px h-6 bg-slate-200" />

            {/* Filtro estado */}
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Filtro asignado */}
            <select
              value={filtroAsignado}
              onChange={(e) => setFiltroAsignado(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los asignados</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>

            {/* Filtro prioridad */}
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las prioridades</option>
              {['Alta', 'Media', 'Baja'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            {hasFilters && (
              <button
                onClick={() => { setFiltroEstado(''); setFiltroAsignado(''); setFiltroPrioridad('') }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}

            <span className="ml-auto text-xs text-slate-400">{filtered.length} tarea{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── VISTA LISTA ── */}
      {view === 'lista' && (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-slate-500 font-medium">No hay tareas con estos filtros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridad</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Proyecto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vence</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Asignado a</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((tarea) => {
                      const vencida = isVencida(tarea)
                      return (
                        <tr key={tarea.id} className={`hover:bg-slate-50/50 transition-colors ${vencida ? 'bg-red-50/30' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              {vencida && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                              <div>
                                <p className="text-sm font-medium text-slate-800">{tarea.titulo}</p>
                                {tarea.descripcion && (
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tarea.descripcion}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getPrioridadBadge(tarea.prioridad)}</td>
                          <td className="px-4 py-3">{getEstadoBadge(tarea.estado)}</td>
                          <td className="px-4 py-3">
                            {tarea.cliente && (
                              <Link href={`/clientes/${tarea.cliente.id}`} className="text-sm text-slate-600 hover:text-blue-600 block">
                                {tarea.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                              </Link>
                            )}
                            {tarea.proyecto && (
                              <Link href={`/proyectos/${tarea.proyecto.id}`} className="text-xs text-slate-400 hover:text-blue-600">
                                {tarea.proyecto.nombre.length > 30 ? tarea.proyecto.nombre.substring(0, 30) + '...' : tarea.proyecto.nombre}
                              </Link>
                            )}
                            {!tarea.cliente && !tarea.proyecto && <span className="text-slate-400 text-sm">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {tarea.fechaLimite ? (
                              <span className={`text-sm font-medium ${vencida ? 'text-red-600' : 'text-slate-600'}`}>
                                {formatDate(new Date(tarea.fechaLimite))}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {tarea.asignado?.nombre || <span className="text-slate-400">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Link href={`/tareas/${tarea.id}/editar`}>
                                <Button variant="ghost" size="sm" title="Editar">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </Link>
                              <DeleteTareaButton id={tarea.id} titulo={tarea.titulo} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── VISTA KANBAN ── */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLS.map((col) => {
            const colTareas = filtered.filter((t) => t.estado === col.estado)
            const isOver = dragOver === col.estado
            return (
              <div
                key={col.estado}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.estado) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(col.estado)}
                className={`rounded-xl border-2 p-3 min-h-[200px] transition-all
                  ${col.color} ${isOver ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.01]' : ''}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">{col.label}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                    {colTareas.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {colTareas.map((t) => <KanbanCard key={t.id} tarea={t} />)}
                  {colTareas.length === 0 && (
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center text-xs text-slate-400 transition-colors
                      ${isOver ? 'border-blue-400 bg-blue-50 text-blue-500' : 'border-slate-200'}`}>
                      {isOver ? 'Soltar aquí' : 'Sin tareas'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
