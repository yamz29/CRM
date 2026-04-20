'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, Pencil, Trash2, Check, X, Loader2, Calendar,
  ShoppingCart, ClipboardList, ArrowRight, ExternalLink, ChevronDown,
} from 'lucide-react'

type Tipo = 'compra' | 'tarea'
type Prioridad = 'Alta' | 'Normal' | 'Baja'
type Estado = 'Pendiente' | 'En Progreso' | 'Completado' | 'Cancelado'

interface Item {
  id: number
  proyectoId: number
  tipo: Tipo
  descripcion: string
  cantidad: string | null
  fechaObjetivo: string | null
  prioridad: Prioridad
  estado: Estado
  notas: string | null
  ordenCompraId: number | null
  orden: number
  completedAt: string | null
  createdAt: string
  ordenCompra: { id: number; numero: string; estado: string } | null
}

interface Proveedor {
  id: number
  nombre: string
}

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  Alta:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Normal: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Baja:   'bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400',
}

function fechaBadge(fechaObjetivo: string | null, estado: Estado) {
  if (!fechaObjetivo) return { text: 'Sin fecha', className: 'text-muted-foreground/60' }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(fechaObjetivo)
  f.setHours(0, 0, 0, 0)
  const diffDays = Math.round((f.getTime() - hoy.getTime()) / 86_400_000)
  const texto = f.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })

  if (estado === 'Completado' || estado === 'Cancelado') {
    return { text: texto, className: 'text-muted-foreground' }
  }
  if (diffDays < 0) return { text: `${texto} · vencida`, className: 'text-red-600 font-semibold' }
  if (diffDays <= 3) return { text: `${texto} · en ${diffDays}d`, className: 'text-amber-600 font-semibold' }
  return { text: texto, className: 'text-muted-foreground' }
}

// ═══════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════

export function ProgramaTab({ proyectoId }: { proyectoId: number }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompletadas, setShowCompletadas] = useState(false)
  const [promoverItem, setPromoverItem] = useState<Item | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/programa`)
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { fetchData() }, [fetchData])

  const compras = items.filter(i => i.tipo === 'compra')
  const tareas  = items.filter(i => i.tipo === 'tarea')

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="text-sm text-muted-foreground">
        Lista operativa del proyecto: compras que hay que hacer (shopping list)
        y tareas del día a día. Cuando una compra se concreta, puedes promoverla
        a una orden de compra formal.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListaColumna
            tipo="compra"
            titulo="Compras programadas"
            icono={ShoppingCart}
            accent="text-blue-600"
            items={compras}
            proyectoId={proyectoId}
            onRefresh={() => { fetchData(); router.refresh() }}
            onPromover={setPromoverItem}
            showCompletadas={showCompletadas}
            setShowCompletadas={setShowCompletadas}
          />
          <ListaColumna
            tipo="tarea"
            titulo="Tareas del proyecto"
            icono={ClipboardList}
            accent="text-emerald-600"
            items={tareas}
            proyectoId={proyectoId}
            onRefresh={() => { fetchData(); router.refresh() }}
            onPromover={() => {}}
            showCompletadas={showCompletadas}
            setShowCompletadas={setShowCompletadas}
          />
        </div>
      )}

      {promoverItem && (
        <PromoverAOCModal
          item={promoverItem}
          onClose={() => setPromoverItem(null)}
          onSuccess={(ocId) => {
            setPromoverItem(null)
            fetchData()
            router.push(`/compras/${ocId}`)
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Columna de lista (compras o tareas)
// ═══════════════════════════════════════════════════════════════════════

function ListaColumna({
  tipo, titulo, icono: Icono, accent, items, proyectoId, onRefresh, onPromover,
  showCompletadas, setShowCompletadas,
}: {
  tipo: Tipo
  titulo: string
  icono: React.ElementType
  accent: string
  items: Item[]
  proyectoId: number
  onRefresh: () => void
  onPromover: (item: Item) => void
  showCompletadas: boolean
  setShowCompletadas: (v: boolean) => void
}) {
  const [nuevoOpen, setNuevoOpen] = useState(false)
  const activos = items.filter(i => i.estado !== 'Completado' && i.estado !== 'Cancelado')
  const completados = items.filter(i => i.estado === 'Completado' || i.estado === 'Cancelado')

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Icono className={`w-4 h-4 ${accent}`} />
          <h3 className="font-semibold text-sm text-foreground">{titulo}</h3>
          <span className="text-xs text-muted-foreground">({activos.length})</span>
        </div>
        {!nuevoOpen && (
          <Button size="sm" variant="secondary" onClick={() => setNuevoOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </Button>
        )}
      </div>

      <div className="p-3 space-y-1">
        {nuevoOpen && (
          <NuevoItemForm
            tipo={tipo}
            proyectoId={proyectoId}
            onCancel={() => setNuevoOpen(false)}
            onSaved={() => { setNuevoOpen(false); onRefresh() }}
          />
        )}

        {activos.length === 0 && !nuevoOpen && (
          <div className="text-center py-8 text-sm text-muted-foreground/70">
            Sin {tipo === 'compra' ? 'compras' : 'tareas'} pendientes
          </div>
        )}

        {activos.map(item => (
          <ItemRow key={item.id} item={item} onRefresh={onRefresh} onPromover={onPromover} />
        ))}

        {completados.length > 0 && (
          <div className="pt-3 border-t border-border/50 mt-2">
            <button
              onClick={() => setShowCompletadas(!showCompletadas)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showCompletadas ? 'rotate-0' : '-rotate-90'}`} />
              Completadas ({completados.length})
            </button>
            {showCompletadas && (
              <div className="space-y-1 mt-2">
                {completados.map(item => (
                  <ItemRow key={item.id} item={item} onRefresh={onRefresh} onPromover={onPromover} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Formulario inline "+ Nuevo"
// ═══════════════════════════════════════════════════════════════════════

function NuevoItemForm({ tipo, proyectoId, onCancel, onSaved }: {
  tipo: Tipo
  proyectoId: number
  onCancel: () => void
  onSaved: () => void
}) {
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [fechaObjetivo, setFechaObjetivo] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('Normal')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!descripcion.trim()) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/programa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          descripcion: descripcion.trim(),
          cantidad: tipo === 'compra' ? cantidad.trim() || null : null,
          fechaObjetivo: fechaObjetivo || null,
          prioridad,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error al crear')
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
      <Input
        autoFocus
        placeholder={tipo === 'compra' ? 'Qué comprar (ej: cemento)' : 'Qué hacer (ej: llamar arquitecto)'}
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        className="h-9 text-sm"
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {tipo === 'compra' && (
          <Input
            placeholder="Cantidad (ej: 20 sacos)"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="h-8 text-xs"
          />
        )}
        <Input
          type="date"
          value={fechaObjetivo}
          onChange={e => setFechaObjetivo(e.target.value)}
          className="h-8 text-xs"
          title="Fecha objetivo"
        />
        <select
          value={prioridad}
          onChange={e => setPrioridad(e.target.value as Prioridad)}
          className="h-8 text-xs rounded-md border border-border bg-card px-2"
        >
          <option value="Alta">Prioridad Alta</option>
          <option value="Normal">Prioridad Normal</option>
          <option value="Baja">Prioridad Baja</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting || !descripcion.trim()}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Agregar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </Button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Fila de item (con checkbox, edición inline, menú)
// ═══════════════════════════════════════════════════════════════════════

function ItemRow({ item, onRefresh, onPromover }: {
  item: Item
  onRefresh: () => void
  onPromover: (item: Item) => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const isDone = item.estado === 'Completado' || item.estado === 'Cancelado'
  const fb = fechaBadge(item.fechaObjetivo, item.estado)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/programa/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onRefresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${item.descripcion}"?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/programa/${item.id}`, { method: 'DELETE' })
      if (res.ok) onRefresh()
    } finally {
      setBusy(false)
    }
  }

  function toggleDone() {
    patch({ estado: isDone ? 'Pendiente' : 'Completado' })
  }

  if (editing) {
    return <EditItemRow item={item} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onRefresh() }} />
  }

  return (
    <div className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors ${isDone ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={toggleDone}
        disabled={busy}
        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-border hover:border-emerald-500'
        }`}
        title={isDone ? 'Reabrir' : 'Completar'}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>

      {/* Descripción + cantidad + fecha */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
        <div className={`text-sm ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {item.descripcion}
          {item.cantidad && <span className="ml-2 text-xs text-muted-foreground">· {item.cantidad}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs mt-0.5">
          <span className={`inline-flex items-center gap-1 ${fb.className}`}>
            <Calendar className="w-3 h-3" /> {fb.text}
          </span>
          {item.prioridad !== 'Normal' && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORIDAD_COLOR[item.prioridad]}`}>
              {item.prioridad}
            </span>
          )}
          {item.ordenCompra && (
            <Link
              href={`/compras/${item.ordenCompra.id}`}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" /> {item.ordenCompra.numero}
            </Link>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.tipo === 'compra' && !isDone && !item.ordenCompraId && (
          <button
            onClick={() => onPromover(item)}
            disabled={busy}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Convertir en orden de compra"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          disabled={busy}
          className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Edición inline de una fila
// ═══════════════════════════════════════════════════════════════════════

function EditItemRow({ item, onCancel, onSaved }: {
  item: Item
  onCancel: () => void
  onSaved: () => void
}) {
  const [descripcion, setDescripcion] = useState(item.descripcion)
  const [cantidad, setCantidad] = useState(item.cantidad ?? '')
  const [fechaObjetivo, setFechaObjetivo] = useState(item.fechaObjetivo ? item.fechaObjetivo.slice(0, 10) : '')
  const [prioridad, setPrioridad] = useState<Prioridad>(item.prioridad)
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    if (!descripcion.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/programa/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          cantidad: item.tipo === 'compra' ? (cantidad.trim() || null) : null,
          fechaObjetivo: fechaObjetivo || null,
          prioridad,
        }),
      })
      if (res.ok) onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 space-y-2">
      <Input
        autoFocus
        value={descripcion}
        onChange={e => setDescripcion(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {item.tipo === 'compra' && (
          <Input
            placeholder="Cantidad"
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="h-8 text-xs"
          />
        )}
        <Input
          type="date"
          value={fechaObjetivo}
          onChange={e => setFechaObjetivo(e.target.value)}
          className="h-8 text-xs"
        />
        <select
          value={prioridad}
          onChange={e => setPrioridad(e.target.value as Prioridad)}
          className="h-8 text-xs rounded-md border border-border bg-card px-2"
        >
          <option value="Alta">Alta</option>
          <option value="Normal">Normal</option>
          <option value="Baja">Baja</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={submitting || !descripcion.trim()}>
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Guardar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          <X className="w-3.5 h-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Modal: Promover a Orden de Compra
// ═══════════════════════════════════════════════════════════════════════

function PromoverAOCModal({ item, onClose, onSuccess }: {
  item: Item
  onClose: () => void
  onSuccess: (ordenCompraId: number) => void
}) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [proveedorId, setProveedorId] = useState<string>('')
  const [cantidadNum, setCantidadNum] = useState<string>(() => {
    const m = item.cantidad?.match(/(\d+(?:[.,]\d+)?)/)
    return m ? m[1].replace(',', '.') : '1'
  })
  const [precioUnitario, setPrecioUnitario] = useState<string>('0')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/proveedores')
      .then(r => r.ok ? r.json() : [])
      .then((data: Proveedor[] | { proveedores?: Proveedor[] }) => {
        const list = Array.isArray(data) ? data : (data.proveedores ?? [])
        setProveedores(list)
      })
      .catch(() => setProveedores([]))
  }, [])

  async function handleSubmit() {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/programa/${item.id}/promover-a-oc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId: proveedorId ? parseInt(proveedorId) : null,
          cantidadNum: parseFloat(cantidadNum) || 1,
          precioUnitario: parseFloat(precioUnitario) || 0,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error al crear orden de compra')
      }
      const data = await res.json()
      onSuccess(data.ordenCompra.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-foreground">Crear orden de compra</h3>
          <p className="text-xs text-muted-foreground mt-1">Se creará una OC en estado borrador a partir de esta compra.</p>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 space-y-1">
          <p className="text-sm font-medium text-foreground">{item.descripcion}</p>
          {item.cantidad && <p className="text-xs text-muted-foreground">Cantidad: {item.cantidad}</p>}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Proveedor (opcional)</Label>
            <select
              value={proveedorId}
              onChange={e => setProveedorId(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-border bg-card px-2"
            >
              <option value="">Sin proveedor (completar después)</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Cantidad numérica</Label>
              <Input
                type="number"
                step="0.01"
                value={cantidadNum}
                onChange={e => setCantidadNum(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio unitario (RD$)</Label>
              <Input
                type="number"
                step="0.01"
                value={precioUnitario}
                onChange={e => setPrecioUnitario(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Crear OC
          </Button>
        </div>
      </div>
    </div>
  )
}
