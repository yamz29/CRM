'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ESTADO_COLORS, PRIORIDAD_COLORS, ETAPA_COLORS } from '@/lib/produccion'
import { Search, X, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface Orden {
  id: number
  codigo: string
  nombre: string
  estado: string
  etapaActual: string
  prioridad: string
  clienteNombre: string | null
  proyecto: { id: number; nombre: string } | null
  _count: { items: number; materiales: number }
  createdAt: string
}

interface Props {
  ordenes: Orden[]
}

export function ProduccionPageClient({ ordenes }: Props) {
  const router = useRouter()
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
          </div>
        </CardContent>
      </Card>

      {/* Orders table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Código</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Etapa Actual</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Prioridad</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Módulos</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No se encontraron órdenes de producción
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const etapaColors = ETAPA_COLORS[o.etapaActual]
                  return (
                    <tr key={o.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-muted-foreground">{o.codigo}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/produccion/${o.id}`} className="font-medium text-foreground hover:text-primary">
                          {o.nombre}
                        </Link>
                        {o.clienteNombre && (
                          <p className="text-xs text-muted-foreground">{o.clienteNombre}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[o.estado] || ''}`}>
                          {o.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${etapaColors?.bg || ''} ${etapaColors?.text || ''}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${etapaColors?.dot || ''}`} />
                          {o.etapaActual === 'Compra de Materiales' ? 'Compra' : o.etapaActual}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLORS[o.prioridad] || ''}`}>
                          {o.prioridad}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{o._count.items}</td>
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
    </div>
  )
}
