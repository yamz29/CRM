'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ESTADO_COLORS, PRIORIDAD_COLORS, ETAPAS_PRODUCCION } from '@/lib/produccion'
import { List, Columns, Search, X, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface ItemSummary {
  id: number
  etapa: string
  completado: boolean
  nombreModulo: string
  cantidad: number
  prioridad: string
}

interface Orden {
  id: number
  codigo: string
  nombre: string
  estado: string
  prioridad: string
  clienteNombre: string | null
  proyecto: { id: number; nombre: string } | null
  items: ItemSummary[]
  _count: { items: number; materiales: number }
  fechaInicio: string | null
  fechaEstimada: string | null
  createdAt: string
}

interface Props {
  ordenes: Orden[]
}

function getProgress(items: ItemSummary[]) {
  if (items.length === 0) return 0
  const completed = items.filter(i => i.completado).length
  return Math.round((completed / items.length) * 100)
}

function getMinEtapa(items: ItemSummary[]) {
  if (items.length === 0) return 'Sin items'
  const etapaOrder = Object.fromEntries(ETAPAS_PRODUCCION.map((e, i) => [e.key, i]))
  let minIdx = 999
  let minLabel = ''
  for (const item of items) {
    if (item.completado) continue
    const idx = etapaOrder[item.etapa] ?? 999
    if (idx < minIdx) { minIdx = idx; minLabel = item.etapa }
  }
  return minLabel || 'Completado'
}

export function ProduccionPageClient({ ordenes }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'lista' | 'kanban'>('lista')
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

  const filtered = ordenes.filter((o) => {
    if (filtroTexto) {
      const q = filtroTexto.toLowerCase()
      const match = o.nombre.toLowerCase().includes(q) ||
        o.codigo.toLowerCase().includes(q) ||
        o.clienteNombre?.toLowerCase().includes(q) ||
        o.proyecto?.nombre.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filtroEstado && o.estado !== filtroEstado) return false
    if (filtroPrioridad && o.prioridad !== filtroPrioridad) return false
    return true
  })

  const hasFilters = filtroTexto || filtroEstado || filtroPrioridad

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta orden de producción?')) return
    setDeleting(id)
    await fetch(`/api/produccion/${id}`, { method: 'DELETE' })
    router.refresh()
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre, código, cliente..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
            >
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Completada">Completada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-input text-foreground text-sm"
            >
              <option value="">Todas las prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
            {hasFilters && (
              <button onClick={() => { setFiltroTexto(''); setFiltroEstado(''); setFiltroPrioridad('') }}
                className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="flex gap-1 ml-auto border border-border rounded-lg p-0.5">
              <button onClick={() => setView('lista')}
                className={`p-1.5 rounded ${view === 'lista' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setView('kanban')}
                className={`p-1.5 rounded ${view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Columns className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {view === 'lista' ? (
        /* ── LIST VIEW ── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Prioridad</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Items</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Progreso</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Etapa Mín.</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                      No se encontraron órdenes de producción
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const progress = getProgress(o.items)
                    const minEtapa = getMinEtapa(o.items)
                    return (
                      <tr key={o.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-muted-foreground">{o.codigo}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/produccion/${o.id}`} className="font-medium text-foreground hover:text-primary">
                            {o.nombre}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{o.clienteNombre || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[o.estado] || ''}`}>
                            {o.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLORS[o.prioridad] || ''}`}>
                            {o.prioridad}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{o._count.items}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-muted-foreground">{minEtapa}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end">
                            <Link href={`/produccion/${o.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-500 hover:text-red-600"
                              onClick={() => handleDelete(o.id)}
                              disabled={deleting === o.id}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ── KANBAN VIEW ── */
        <KanbanOrdenes ordenes={filtered} />
      )}
    </div>
  )
}

function KanbanOrdenes({ ordenes }: { ordenes: Orden[] }) {
  const cols = [
    { estado: 'Pendiente',   color: 'border-border bg-muted/40 dark:bg-muted/20' },
    { estado: 'En Proceso',  color: 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20' },
    { estado: 'Completada',  color: 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20' },
    { estado: 'Cancelada',   color: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cols.map((col) => {
        const items = ordenes.filter(o => o.estado === col.estado)
        return (
          <div key={col.estado} className={`rounded-xl border-2 ${col.color} p-3 min-h-[200px]`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-foreground">{col.estado}</h3>
              <Badge variant="default">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.map((o) => (
                <Link key={o.id} href={`/produccion/${o.id}`}>
                  <div className="bg-card border border-border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">{o.nombre}</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mb-1">{o.codigo}</p>
                    {o.clienteNombre && (
                      <p className="text-xs text-muted-foreground mb-1">{o.clienteNombre}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORIDAD_COLORS[o.prioridad] || ''}`}>
                        {o.prioridad}
                      </span>
                      <span className="text-xs text-muted-foreground">{o._count.items} items</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-muted rounded-full h-1">
                        <div className="bg-primary h-1 rounded-full" style={{ width: `${getProgress(o.items)}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{getProgress(o.items)}%</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
