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
  avance: number
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
  { estado: 'Pendiente',   label: 'Por hacer',   color: 'border-border bg-muted/40 dark:bg-muted/20',  badge: 'bg-muted text-muted-foreground' },
  { estado: 'En proceso',  label: 'En proceso',  color: 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  { estado: 'Completada',  label: 'Completado',  color: 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  { estado: 'Cancelada',   label: 'Cancelada',   color: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',      badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
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
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAsignado, setFiltroAsignado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')

  // DnD state
  const draggingId = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const filtered = tareas.filter((t) => {
    if (filtroTexto) {
      const q = filtroTexto.toLowerCase()
      const match = t.titulo.toLowerCase().includes(q) ||
        t.descripcion?.toLowerCase().includes(q) ||
        t.cliente?.nombre.toLowerCase().includes(q) ||
        t.proyecto?.nombre.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filtroEstado && t.estado !== filtroEstado) return false
    if (filtroAsignado && String(t.asignado?.id ?? '') !== filtroAsignado) return false
    if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false
    return true
  })

  const isVencida = (t: Tarea) =>
    t.fechaLimite &&
    new Date(t.fechaLimite) < today &&
    !['Completada', 'Cancelada'].includes(t.estado)

  const hasFilters = filtroTexto || filtroEstado || filtroAsignado || filtroPrioridad

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
        className={`bg-card border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing select-none
          ${vencida ? 'border-red-400 dark:border-red-800' : 'border-border'} hover:shadow-md transition-shadow`}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">{tarea.titulo}</p>
          {vencida && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
        </div>
        {tarea.descripcion && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{tarea.descripcion}</p>
        )}
        {tarea.avance > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex-1 bg-muted rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${tarea.avance}%` }} />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{tarea.avance}%</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {getPrioridadBadge(tarea.prioridad)}
          {tarea.asignado && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
              {tarea.asignado.nombre.split(' ')[0]}
            </span>
          )}
        </div>
        {tarea.fechaLimite && (
          <p className={`text-xs mt-1.5 ${vencida ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
            {formatDate(new Date(tarea.fechaLimite))}
          </p>
        )}
        <div className="flex gap-1 mt-2 pt-2 border-t border-border">
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
            {/* Búsqueda textual */}
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por título, cliente, proyecto..."
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-w-[220px]"
            />

            <div className="w-px h-6 bg-border" />

            {/* Toggle vista */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setView('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors
                  ${view === 'lista' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                <List className="w-3.5 h-3.5" /> Lista
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors
                  ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                <Columns className="w-3.5 h-3.5" /> Kanban
              </button>
            </div>

            <div className="w-px h-6 bg-border" />

            {/* Filtro estado */}
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Filtro asignado */}
            <select
              value={filtroAsignado}
              onChange={(e) => setFiltroAsignado(e.target.value)}
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los asignados</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>

            {/* Filtro prioridad */}
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="border border-border rounded-lg px-2.5 py-1.5 text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas las prioridades</option>
              {['Alta', 'Media', 'Baja'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            {hasFilters && (
              <button
                onClick={() => { setFiltroTexto(''); setFiltroEstado(''); setFiltroAsignado(''); setFiltroPrioridad('') }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} tarea{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── VISTA LISTA ── */}
      {view === 'lista' && (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground font-medium">No hay tareas con estos filtros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prioridad</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente / Proyecto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vence</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asignado a</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((tarea) => {
                      const vencida = isVencida(tarea)
                      return (
                        <tr key={tarea.id} className={`hover:bg-muted/30 transition-colors ${vencida ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              {vencida && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{tarea.titulo}</p>
                                {tarea.descripcion && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tarea.descripcion}</p>
                                )}
                                {tarea.avance > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-20 bg-muted rounded-full h-1.5">
                                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${tarea.avance}%` }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground">{tarea.avance}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getPrioridadBadge(tarea.prioridad)}</td>
                          <td className="px-4 py-3">{getEstadoBadge(tarea.estado)}</td>
                          <td className="px-4 py-3">
                            {tarea.cliente && (
                              <Link href={`/clientes/${tarea.cliente.id}`} className="text-sm text-muted-foreground hover:text-primary block">
                                {tarea.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                              </Link>
                            )}
                            {tarea.proyecto && (
                              <Link href={`/proyectos/${tarea.proyecto.id}`} className="text-xs text-muted-foreground/70 hover:text-primary">
                                {tarea.proyecto.nombre.length > 30 ? tarea.proyecto.nombre.substring(0, 30) + '...' : tarea.proyecto.nombre}
                              </Link>
                            )}
                            {!tarea.cliente && !tarea.proyecto && <span className="text-muted-foreground/50 text-sm">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {tarea.fechaLimite ? (
                              <span className={`text-sm font-medium ${vencida ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {formatDate(new Date(tarea.fechaLimite))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {tarea.asignado?.nombre || <span className="text-muted-foreground/50">-</span>}
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
                  ${col.color} ${isOver ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.01]' : ''}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                    {colTareas.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {colTareas.map((t) => <KanbanCard key={t.id} tarea={t} />)}
                  {colTareas.length === 0 && (
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground transition-colors
                      ${isOver ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}>
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
