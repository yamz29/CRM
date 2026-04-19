'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LayoutGrid, List, Search, TrendingUp, DollarSign, Target, Archive, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { OportunidadForm } from './OportunidadForm'
import { OportunidadDrawer } from './OportunidadDrawer'
import { MarcarPerdidaModal } from './MarcarPerdidaModal'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Oportunidad {
  id: number
  clienteId: number
  nombre: string
  etapa: string
  valor: number | null
  moneda: string
  probabilidad: number | null
  fechaCierreEst: string | null
  responsable: string | null
  motivoPerdida: string | null
  categoriaPerdida: string | null
  notas: string | null
  proyectoId: number | null
  urgente: boolean
  archivada: boolean
  fechaArchivada: string | null
  createdAt: string
  updatedAt: string
  cliente: { id: number; nombre: string }
  proyecto: { id: number; nombre: string } | null
  presupuestos: { id: number; numero: string; estado: string; total: number }[]
  _count: { actividades: number; tareas: number }
}

export interface PresupuestoOpcion {
  id: number
  numero: string
  clienteId: number
  estado: string
  total: number
}

export interface UsuarioOpcion {
  id: number
  nombre: string
}

interface Props {
  oportunidades: Oportunidad[]
  clientes: { id: number; nombre: string }[]
  presupuestos: PresupuestoOpcion[]
  usuarios: UsuarioOpcion[]
}

// ── Etapas config ─────────────────────────────────────────────────────────────

export const ETAPAS = [
  { key: 'Lead',          label: 'Lead',          color: 'bg-slate-500',  light: 'bg-muted text-foreground',  border: 'border-border' },
  { key: 'Levantamiento', label: 'Levantamiento', color: 'bg-blue-500',   light: 'bg-blue-100 text-blue-700',    border: 'border-blue-200 dark:border-blue-800' },
  { key: 'Cotización',    label: 'Cotización',    color: 'bg-yellow-500', light: 'bg-yellow-100 text-yellow-700',border: 'border-yellow-200 dark:border-yellow-800' },
  { key: 'Negociación',   label: 'Negociación',   color: 'bg-orange-500', light: 'bg-orange-100 text-orange-700',border: 'border-orange-200 dark:border-orange-800' },
  { key: 'Ganado',        label: 'Ganado',        color: 'bg-green-500',  light: 'bg-green-100 text-green-700',  border: 'border-green-200 dark:border-green-800' },
  { key: 'Perdido',       label: 'Perdido',       color: 'bg-red-500',    light: 'bg-red-100 text-red-700',      border: 'border-red-200 dark:border-red-800' },
]

function diasEnEtapa(updatedAt: string) {
  const diff = Date.now() - new Date(updatedAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({
  op,
  onDragStart,
  onClick,
  onToggleUrgente,
}: {
  op: Oportunidad
  onDragStart: (e: React.DragEvent, id: number) => void
  onClick: (op: Oportunidad) => void
  onToggleUrgente: (id: number, urgente: boolean) => void
}) {
  const dias = diasEnEtapa(op.updatedAt)
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, op.id)}
      onClick={() => onClick(op)}
      className={`bg-card border rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group ${op.urgente ? 'border-amber-400 dark:border-amber-600' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
          {op.nombre}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleUrgente(op.id, !op.urgente) }}
          className={`shrink-0 transition-colors ${op.urgente ? 'text-amber-500' : 'text-transparent group-hover:text-muted-foreground/40'}`}
          title={op.urgente ? 'Quitar urgente' : 'Marcar urgente'}
        >
          <Star className={`w-3.5 h-3.5 ${op.urgente ? 'fill-amber-500' : ''}`} />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{op.cliente.nombre}</p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-bold text-foreground tabular-nums">
          {op.valor ? formatCurrency(op.valor) : '—'}
        </span>
        <div className="flex items-center gap-1.5">
          {op.presupuestos.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
              {op.presupuestos.length} cot.
            </span>
          )}
          {op._count.tareas > 0 && (
            <span className="text-xs text-muted-foreground">{op._count.tareas} tareas</span>
          )}
          {op._count.actividades > 0 && (
            <span className="text-xs text-muted-foreground">{op._count.actividades} act.</span>
          )}
        </div>
      </div>

      {dias > 0 && (
        <p className={`text-xs mt-1.5 ${dias > 14 ? 'text-red-400' : 'text-muted-foreground'}`}>
          {dias}d en esta etapa
        </p>
      )}
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  etapa,
  items,
  onDragStart,
  onDrop,
  onDragOver,
  onCardClick,
  onToggleUrgente,
}: {
  etapa: typeof ETAPAS[0]
  items: Oportunidad[]
  onDragStart: (e: React.DragEvent, id: number) => void
  onDrop: (e: React.DragEvent, etapa: string) => void
  onDragOver: (e: React.DragEvent) => void
  onCardClick: (op: Oportunidad) => void
  onToggleUrgente: (id: number, urgente: boolean) => void
}) {
  const total = items.reduce((s, o) => s + (o.valor ?? 0), 0)
  return (
    <div
      className="flex-1 min-w-[200px] max-w-[260px] flex flex-col"
      onDrop={(e) => onDrop(e, etapa.key)}
      onDragOver={onDragOver}
    >
      {/* Column header */}
      <div className={`rounded-t-lg px-3 py-2 border-b-2 ${etapa.border} bg-card`}>
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${etapa.color}`} />
            <span className="text-xs font-semibold text-foreground">{etapa.label}</span>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {total > 0 && (
          <p className="text-xs text-muted-foreground pl-4 tabular-nums">{formatCurrency(total)}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 bg-muted/20 rounded-b-lg border border-t-0 border-border p-2 space-y-2 min-h-[200px]">
        {items.map((op) => (
          <KanbanCard key={op.id} op={op} onDragStart={onDragStart} onClick={onCardClick} onToggleUrgente={onToggleUrgente} />
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PipelineClient({ oportunidades: initial, clientes, presupuestos, usuarios }: Props) {
  const router = useRouter()
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>(initial)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [q, setQ] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Oportunidad | null>(null)
  const [drawerOp, setDrawerOp] = useState<Oportunidad | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [verArchivadas, setVerArchivadas] = useState(false)
  const [filtroUrgente, setFiltroUrgente] = useState(false)
  const [perdidaPending, setPerdidaPending] = useState<Oportunidad | null>(null)

  const filtered = useMemo(() => {
    return oportunidades.filter((o) => {
      if (verArchivadas) {
        if (!o.archivada) return false
      } else {
        if (o.archivada) return false
      }
      if (filtroUrgente && !o.urgente) return false
      if (filtroEtapa && o.etapa !== filtroEtapa) return false
      if (filtroResponsable && o.responsable !== filtroResponsable) return false
      if (q) {
        const lq = q.toLowerCase()
        if (!o.nombre.toLowerCase().includes(lq) && !o.cliente.nombre.toLowerCase().includes(lq)) return false
      }
      return true
    })
  }, [oportunidades, q, filtroEtapa, filtroResponsable, verArchivadas, filtroUrgente])

  // Stats (solo no archivadas)
  const noArchivadas = oportunidades.filter((o) => !o.archivada)
  const activas = noArchivadas.filter((o) => !['Ganado', 'Perdido'].includes(o.etapa))
  const valorPipeline = activas.reduce((s, o) => s + (o.valor ?? 0), 0)
  const ganadas = noArchivadas.filter((o) => o.etapa === 'Ganado').length
  const cerradas = ganadas + noArchivadas.filter((o) => o.etapa === 'Perdido').length
  const tasaCierre = cerradas > 0 ? Math.round((ganadas / cerradas) * 100) : null
  const totalArchivadas = oportunidades.filter((o) => o.archivada).length

  async function reload() {
    const res = await fetch('/api/oportunidades')
    if (!res.ok) return
    const data = await res.json()
    setOportunidades(data)
    if (drawerOp) {
      const updated = data.find((o: Oportunidad) => o.id === drawerOp.id)
      if (updated) setDrawerOp(updated)
    }
  }

  // Drag-drop handlers
  function handleDragStart(e: React.DragEvent, id: number) {
    setDragging(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, nuevaEtapa: string) {
    e.preventDefault()
    if (!dragging) return
    const op = oportunidades.find((o) => o.id === dragging)
    const idArrastrado = dragging
    setDragging(null)
    if (!op || op.etapa === nuevaEtapa) return

    // Si la nueva etapa es Perdido, abrir modal en vez de guardar directo
    if (nuevaEtapa === 'Perdido') {
      setPerdidaPending(op)
      return
    }

    // Guardar estado previo para rollback si falla la red.
    const prevEtapa = op.etapa
    setOportunidades((prev) => prev.map((o) => o.id === idArrastrado ? { ...o, etapa: nuevaEtapa, updatedAt: new Date().toISOString() } : o))

    try {
      const res = await fetch(`/api/oportunidades/${idArrastrado}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapa: nuevaEtapa }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      router.refresh()
    } catch (err) {
      // Rollback: restaurar la etapa anterior.
      setOportunidades((prev) => prev.map((o) => o.id === idArrastrado ? { ...o, etapa: prevEtapa } : o))
      console.error('No se pudo mover la oportunidad', err)
      alert('No se pudo mover la oportunidad. Verifique su conexión e intente de nuevo.')
    }
  }

  async function handleToggleUrgente(id: number, urgente: boolean) {
    const prevUrgente = !urgente
    setOportunidades((prev) => prev.map((o) => o.id === id ? { ...o, urgente } : o))
    if (drawerOp?.id === id) setDrawerOp((prev) => prev ? { ...prev, urgente } : prev)
    try {
      const res = await fetch(`/api/oportunidades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgente }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      // Rollback.
      setOportunidades((prev) => prev.map((o) => o.id === id ? { ...o, urgente: prevUrgente } : o))
      if (drawerOp?.id === id) setDrawerOp((prev) => prev ? { ...prev, urgente: prevUrgente } : prev)
      console.error('No se pudo cambiar urgencia', err)
    }
  }

  function handleCardClick(op: Oportunidad) {
    setDrawerOp(op)
  }

  function handleNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleEdit(op: Oportunidad) {
    setEditing(op)
    setFormOpen(true)
    setDrawerOp(null)
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">En Pipeline</p>
            <p className="text-lg font-bold text-foreground">{activas.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor Pipeline</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(valorPipeline)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tasa de cierre</p>
            <p className="text-lg font-bold text-foreground">{tasaCierre !== null ? `${tasaCierre}%` : '—'}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar oportunidad o cliente..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {view === 'lista' && (
          <select
            value={filtroEtapa}
            onChange={(e) => setFiltroEtapa(e.target.value)}
            className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground"
          >
            <option value="">Todas las etapas</option>
            {ETAPAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        )}
        <select
          value={filtroResponsable}
          onChange={(e) => setFiltroResponsable(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground"
        >
          <option value="">Todos los responsables</option>
          {usuarios.map((u) => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
        </select>
        <button
          onClick={() => setFiltroUrgente(!filtroUrgente)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
            ${filtroUrgente
              ? 'bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
        >
          <Star className={`w-3.5 h-3.5 ${filtroUrgente ? 'fill-amber-500' : ''}`} />
          Urgentes
        </button>
        <button
          onClick={() => setVerArchivadas(!verArchivadas)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
            ${verArchivadas
              ? 'bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800'
              : 'bg-card text-muted-foreground border-border hover:bg-muted'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          Archivadas{totalArchivadas > 0 ? ` (${totalArchivadas})` : ''}
        </button>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView('lista')}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${view === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            <List className="w-3.5 h-3.5" /> Lista
          </button>
        </div>
        <Button onClick={handleNew} className="flex items-center gap-2 h-8 text-xs px-3">
          <Plus className="w-3.5 h-3.5" /> Nueva Oportunidad
        </Button>
      </div>

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ETAPAS.map((etapa) => (
            <KanbanColumn
              key={etapa.key}
              etapa={etapa}
              items={filtered.filter((o) => o.etapa === etapa.key)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onCardClick={handleCardClick}
              onToggleUrgente={handleToggleUrgente}
            />
          ))}
        </div>
      )}

      {/* Lista view */}
      {view === 'lista' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">No hay oportunidades{q ? ' con esa búsqueda' : ''}.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="px-2 py-2.5 w-8"></th>
                    <th className="px-4 py-2.5 text-left">Oportunidad</th>
                    <th className="px-4 py-2.5 text-left">Cliente</th>
                    <th className="px-4 py-2.5 text-left">Etapa</th>
                    <th className="px-4 py-2.5 text-right">Valor</th>
                    <th className="px-4 py-2.5 text-left">Responsable</th>
                    <th className="px-4 py-2.5 text-left">Cierre est.</th>
                    <th className="px-4 py-2.5 text-center">Cot.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((op) => {
                    const etapaCfg = ETAPAS.find((e) => e.key === op.etapa)
                    return (
                      <tr
                        key={op.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleCardClick(op)}
                      >
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleUrgente(op.id, !op.urgente) }}
                            className={`transition-colors ${op.urgente ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-muted-foreground/60'}`}
                            title={op.urgente ? 'Quitar urgente' : 'Marcar urgente'}
                          >
                            <Star className={`w-3.5 h-3.5 ${op.urgente ? 'fill-amber-500' : ''}`} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{op.nombre}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{op.cliente.nombre}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${etapaCfg?.light ?? ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${etapaCfg?.color}`} />
                            {op.etapa}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">
                          {op.valor ? formatCurrency(op.valor) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{op.responsable ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {op.fechaCierreEst ? new Date(op.fechaCierreEst).toLocaleDateString('es-DO') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{op.presupuestos.length}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Form modal */}
      {formOpen && (
        <OportunidadForm
          clientes={clientes}
          presupuestos={presupuestos}
          usuarios={usuarios}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); reload() }}
        />
      )}

      {/* Drawer */}
      {drawerOp && (
        <OportunidadDrawer
          oportunidad={drawerOp}
          presupuestosDisponibles={presupuestos.filter(
            (p) => p.clienteId === drawerOp.clienteId
          )}
          onClose={() => setDrawerOp(null)}
          onEdit={handleEdit}
          onSaved={reload}
        />
      )}

      {/* Modal al arrastrar a Perdido */}
      {perdidaPending && (
        <MarcarPerdidaModal
          oportunidadId={perdidaPending.id}
          oportunidadNombre={perdidaPending.nombre}
          onClose={() => setPerdidaPending(null)}
          onSuccess={async () => {
            setPerdidaPending(null)
            await reload()
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
