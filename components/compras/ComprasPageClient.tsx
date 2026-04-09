'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ShoppingCart, Plus, Search, FileText, Truck, Building2, Calendar,
  Check, X, Loader2, Eye, ChevronDown, Package,
} from 'lucide-react'

interface Proveedor { id: number; nombre: string; condicionesPago: string | null }
interface Proyecto { id: number; nombre: string }
interface Orden {
  id: number
  numero: string
  estado: string
  fechaEmision: string
  fechaEntrega: string | null
  moneda: string
  subtotal: number
  total: number
  notas: string | null
  proveedor: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string } | null
  _count: { items: number }
}

const ESTADOS_BADGE: Record<string, { label: string; color: string }> = {
  borrador:          { label: 'Borrador',          color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  enviada:           { label: 'Enviada',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  recibida_parcial:  { label: 'Recibida parcial',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  recibida:          { label: 'Recibida',          color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  facturada:         { label: 'Facturada',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  cancelada:         { label: 'Cancelada',         color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const FILTROS_ESTADO = ['todos', 'borrador', 'enviada', 'recibida_parcial', 'recibida', 'facturada', 'cancelada']

function fmt(v: number, moneda = 'RD$') {
  return `${moneda} ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ComprasPageClient({
  ordenesIniciales,
  proveedores,
  proyectos,
}: {
  ordenesIniciales: Orden[]
  proveedores: Proveedor[]
  proyectos: Proyecto[]
}) {
  const router = useRouter()
  const [ordenes, setOrdenes] = useState(ordenesIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    proveedorId: '',
    proyectoId: '',
    fechaEntrega: '',
    condicionesPago: '',
    moneda: 'RD$',
    notas: '',
  })

  const refreshData = useCallback(async () => {
    const res = await fetch('/api/compras')
    if (res.ok) setOrdenes(await res.json())
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error')
      const nueva = await res.json()
      setShowForm(false)
      setForm({ proveedorId: '', proyectoId: '', fechaEntrega: '', condicionesPago: '', moneda: 'RD$', notas: '' })
      // Navegar al detalle para agregar items
      router.push(`/compras/${nueva.id}`)
    } catch {
      alert('Error al crear orden de compra')
    } finally {
      setSubmitting(false)
    }
  }

  const filtradas = ordenes.filter((o) => {
    if (filtroEstado !== 'todos' && o.estado !== filtroEstado) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return o.numero.toLowerCase().includes(q) ||
      o.proveedor?.nombre.toLowerCase().includes(q) ||
      o.proyecto?.nombre.toLowerCase().includes(q)
  })

  // KPIs
  const totalOC = ordenes.length
  const totalPendiente = ordenes.filter(o => ['borrador', 'enviada'].includes(o.estado)).reduce((s, o) => s + o.total, 0)
  const totalRecibido = ordenes.filter(o => ['recibida', 'facturada'].includes(o.estado)).reduce((s, o) => s + o.total, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            Ordenes de Compra
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de compras a proveedores</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4" /> Nueva OC
          </Button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground">Total OC</p>
          <p className="text-2xl font-bold text-foreground">{totalOC}</p>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground">Pendiente de recibir</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(totalPendiente)}</p>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <p className="text-xs text-muted-foreground">Total recibido</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalRecibido)}</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border border-border rounded-xl bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" /> Nueva Orden de Compra
          </h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Proveedor</Label>
                <select
                  value={form.proveedorId}
                  onChange={(e) => {
                    const prov = proveedores.find(p => p.id === parseInt(e.target.value))
                    setForm(f => ({
                      ...f,
                      proveedorId: e.target.value,
                      condicionesPago: prov?.condicionesPago || f.condicionesPago,
                    }))
                  }}
                  className="w-full h-9 text-sm border border-border rounded-md px-3 bg-card"
                >
                  <option value="">— Sin proveedor —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Proyecto (opcional)</Label>
                <select
                  value={form.proyectoId}
                  onChange={(e) => setForm(f => ({ ...f, proyectoId: e.target.value }))}
                  className="w-full h-9 text-sm border border-border rounded-md px-3 bg-card"
                >
                  <option value="">— Sin proyecto —</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha de entrega estimada</Label>
                <Input
                  type="date"
                  value={form.fechaEntrega}
                  onChange={(e) => setForm(f => ({ ...f, fechaEntrega: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Condiciones de pago</Label>
                <Input
                  value={form.condicionesPago}
                  onChange={(e) => setForm(f => ({ ...f, condicionesPago: e.target.value }))}
                  placeholder="ej: Contado, 30 días"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notas</Label>
                <Input
                  value={form.notas}
                  onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} size="sm">
                <Check className="w-3.5 h-3.5" /> {submitting ? 'Creando...' : 'Crear y agregar items'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por # OC, proveedor, proyecto..."
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTROS_ESTADO.map((est) => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filtroEstado === est
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {est === 'todos' ? 'Todos' : ESTADOS_BADGE[est]?.label || est}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filtradas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Sin órdenes de compra</p>
          <p className="text-xs text-muted-foreground mt-1">Crea tu primera OC para gestionar compras a proveedores</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">OC #</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Proveedor</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Proyecto</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Items</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((o) => {
                const badge = ESTADOS_BADGE[o.estado] || { label: o.estado, color: 'bg-slate-100 text-slate-700' }
                return (
                  <tr key={o.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/compras/${o.id}`)}>
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{o.numero}</td>
                    <td className="px-4 py-3 text-foreground">
                      {o.proveedor ? (
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                          {o.proveedor.nombre}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.proyecto ? (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {o.proyecto.nombre}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(o.fechaEmision).toLocaleDateString('es-DO')}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{o._count.items}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{fmt(o.total, o.moneda)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 text-muted-foreground hover:text-blue-600 rounded" title="Ver detalle">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
