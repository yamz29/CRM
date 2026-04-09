'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, ShoppingCart, Plus, Trash2, Check, X, Pencil, Save,
  Truck, Building2, PackageCheck, Send, FileText, Loader2,
} from 'lucide-react'

interface Item {
  id: number
  descripcion: string
  unidad: string
  cantidad: number
  cantidadRecibida: number
  precioUnitario: number
  subtotal: number
  observaciones: string | null
}

interface Orden {
  id: number
  numero: string
  estado: string
  fechaEmision: string
  fechaEntrega: string | null
  fechaRecepcion: string | null
  condicionesPago: string | null
  moneda: string
  subtotal: number
  impuesto: number
  total: number
  notas: string | null
  proveedor: { id: number; nombre: string; rnc?: string | null; condicionesPago?: string | null; telefono?: string | null; correo?: string | null } | null
  proyecto: { id: number; nombre: string } | null
  items: Item[]
}

interface Proveedor { id: number; nombre: string; condicionesPago: string | null }
interface Proyecto { id: number; nombre: string }

const ESTADOS_BADGE: Record<string, { label: string; color: string }> = {
  borrador:          { label: 'Borrador',          color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  enviada:           { label: 'Enviada',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  recibida_parcial:  { label: 'Recibida parcial',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  recibida:          { label: 'Recibida',          color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  facturada:         { label: 'Facturada',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  cancelada:         { label: 'Cancelada',         color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

function fmt(v: number, moneda = 'RD$') {
  return `${moneda} ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const emptyItem = { descripcion: '', unidad: 'ud', cantidad: '1', precioUnitario: '0', observaciones: '' }

export function OrdenCompraDetail({
  ordenInicial,
  proveedores,
  proyectos,
}: {
  ordenInicial: Orden
  proveedores: Proveedor[]
  proyectos: Proyecto[]
}) {
  const router = useRouter()
  const [orden, setOrden] = useState(ordenInicial)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState(emptyItem)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState(emptyItem)
  const [submitting, setSubmitting] = useState(false)
  const [showRecibir, setShowRecibir] = useState(false)
  const [recibidos, setRecibidos] = useState<Record<number, string>>({})

  const refreshOrden = useCallback(async () => {
    const res = await fetch(`/api/compras/${orden.id}`)
    if (res.ok) setOrden(await res.json())
  }, [orden.id])

  const esBorrador = orden.estado === 'borrador'
  const badge = ESTADOS_BADGE[orden.estado] || { label: orden.estado, color: '' }

  // --- Item CRUD ---
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/compras/${orden.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: newItem.descripcion,
          unidad: newItem.unidad,
          cantidad: parseFloat(newItem.cantidad),
          precioUnitario: parseFloat(newItem.precioUnitario),
          observaciones: newItem.observaciones,
        }),
      })
      if (!res.ok) throw new Error()
      setShowAddItem(false)
      setNewItem(emptyItem)
      await refreshOrden()
    } catch { alert('Error al agregar item') }
    finally { setSubmitting(false) }
  }

  function startEditItem(item: Item) {
    setEditingItemId(item.id)
    setEditItem({
      descripcion: item.descripcion,
      unidad: item.unidad,
      cantidad: String(item.cantidad),
      precioUnitario: String(item.precioUnitario),
      observaciones: item.observaciones || '',
    })
  }

  async function handleUpdateItem(itemId: number) {
    setSubmitting(true)
    try {
      await fetch(`/api/compras/${orden.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: editItem.descripcion,
          unidad: editItem.unidad,
          cantidad: parseFloat(editItem.cantidad),
          precioUnitario: parseFloat(editItem.precioUnitario),
          observaciones: editItem.observaciones,
        }),
      })
      setEditingItemId(null)
      await refreshOrden()
    } catch { alert('Error al actualizar') }
    finally { setSubmitting(false) }
  }

  async function handleDeleteItem(itemId: number) {
    if (!confirm('¿Eliminar esta línea?')) return
    await fetch(`/api/compras/${orden.id}/items/${itemId}`, { method: 'DELETE' })
    await refreshOrden()
  }

  // --- Estado transitions ---
  async function cambiarEstado(nuevoEstado: string) {
    const res = await fetch(`/api/compras/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    if (res.ok) await refreshOrden()
  }

  // --- Recepción ---
  async function handleRecibir() {
    setSubmitting(true)
    try {
      const items = orden.items.map(i => ({
        itemId: i.id,
        cantidadRecibida: parseFloat(recibidos[i.id] || String(i.cantidadRecibida)) || 0,
      }))
      const res = await fetch(`/api/compras/${orden.id}/recibir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (res.ok) {
        setOrden(await res.json())
        setShowRecibir(false)
      }
    } catch { alert('Error al registrar recepción') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/compras" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              {orden.numero}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                {badge.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Emitida: {new Date(orden.fechaEmision).toLocaleDateString('es-DO')}
              </span>
              {orden.fechaEntrega && (
                <span className="text-xs text-muted-foreground">
                  | Entrega est.: {new Date(orden.fechaEntrega).toLocaleDateString('es-DO')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {esBorrador && orden.items.length > 0 && (
            <Button size="sm" onClick={() => cambiarEstado('enviada')}>
              <Send className="w-3.5 h-3.5" /> Marcar como enviada
            </Button>
          )}
          {orden.estado === 'enviada' && (
            <Button size="sm" variant="outline" onClick={() => { setShowRecibir(true); setRecibidos({}) }}>
              <PackageCheck className="w-3.5 h-3.5" /> Registrar recepción
            </Button>
          )}
          {orden.estado === 'recibida_parcial' && (
            <Button size="sm" variant="outline" onClick={() => { setShowRecibir(true); setRecibidos({}) }}>
              <PackageCheck className="w-3.5 h-3.5" /> Actualizar recepción
            </Button>
          )}
          {orden.estado === 'recibida' && (
            <Button size="sm" variant="outline" onClick={() => cambiarEstado('facturada')}>
              <FileText className="w-3.5 h-3.5" /> Marcar facturada
            </Button>
          )}
          {esBorrador && (
            <Button size="sm" variant="danger" onClick={() => { if (confirm('¿Cancelar esta OC?')) cambiarEstado('cancelada') }}>
              <X className="w-3.5 h-3.5" /> Cancelar OC
            </Button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4 bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> Proveedor
          </p>
          {orden.proveedor ? (
            <div>
              <p className="font-medium text-foreground">{orden.proveedor.nombre}</p>
              {orden.proveedor.rnc && <p className="text-xs text-muted-foreground">RNC: {orden.proveedor.rnc}</p>}
              {orden.proveedor.telefono && <p className="text-xs text-muted-foreground">Tel: {orden.proveedor.telefono}</p>}
              {orden.proveedor.correo && <p className="text-xs text-muted-foreground">{orden.proveedor.correo}</p>}
            </div>
          ) : <p className="text-sm text-muted-foreground">Sin proveedor asignado</p>}
          {orden.condicionesPago && <p className="text-xs text-muted-foreground">Cond. pago: {orden.condicionesPago}</p>}
        </div>
        <div className="border border-border rounded-xl p-4 bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Proyecto
          </p>
          {orden.proyecto ? (
            <Link href={`/proyectos/${orden.proyecto.id}`} className="text-sm font-medium text-blue-600 hover:underline">
              {orden.proyecto.nombre}
            </Link>
          ) : <p className="text-sm text-muted-foreground">Sin proyecto asociado</p>}
          {orden.notas && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">{orden.notas}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recepción mode */}
      {showRecibir && (
        <div className="border-2 border-amber-500 rounded-xl bg-amber-50 dark:bg-amber-900/10 p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-amber-600" /> Registrar Recepción
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-amber-100/50 dark:bg-amber-900/20">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold">Descripción</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Pedido</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Ya recibido</th>
                <th className="px-3 py-2 text-right text-xs font-semibold w-32">Recibir ahora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orden.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-foreground">{item.descripcion}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.cantidad} {item.unidad}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{item.cantidadRecibida}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      max={item.cantidad}
                      value={recibidos[item.id] ?? String(item.cantidad)}
                      onChange={(e) => setRecibidos(r => ({ ...r, [item.id]: e.target.value }))}
                      className="h-8 text-sm text-right w-24 ml-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRecibir} disabled={submitting}>
              <Check className="w-3.5 h-3.5" /> {submitting ? 'Guardando...' : 'Confirmar recepción'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowRecibir(false)}>
              <X className="w-3.5 h-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Líneas de la orden ({orden.items.length})</h3>
          {esBorrador && !showAddItem && (
            <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </Button>
          )}
        </div>

        {/* Add item form */}
        {showAddItem && (
          <form onSubmit={handleAddItem} className="border-b border-border bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5 space-y-1">
                <Label className="text-xs">Descripción *</Label>
                <Input required value={newItem.descripcion} onChange={(e) => setNewItem(f => ({ ...f, descripcion: e.target.value }))} placeholder="Material o servicio..." className="h-8 text-sm" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Input value={newItem.unidad} onChange={(e) => setNewItem(f => ({ ...f, unidad: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" step="any" min="0" value={newItem.cantidad} onChange={(e) => setNewItem(f => ({ ...f, cantidad: e.target.value }))} className="h-8 text-sm text-right" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">P. Unitario</Label>
                <Input type="number" step="any" min="0" value={newItem.precioUnitario} onChange={(e) => setNewItem(f => ({ ...f, precioUnitario: e.target.value }))} className="h-8 text-sm text-right" />
              </div>
              <div className="col-span-2 flex items-end gap-1">
                <Button type="submit" size="sm" disabled={submitting}><Check className="w-3.5 h-3.5" /></Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowAddItem(false)}><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </form>
        )}

        {orden.items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Sin líneas. {esBorrador ? 'Agrega items a la orden.' : ''}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Ud</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Cant.</th>
                {!esBorrador && <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Recibido</th>}
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">P. Unit.</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</th>
                {esBorrador && <th className="px-4 py-2 w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orden.items.map((item) => {
                if (editingItemId === item.id) {
                  return (
                    <tr key={item.id} className="bg-blue-50/50 dark:bg-blue-900/10">
                      <td className="px-4 py-2"><Input value={editItem.descripcion} onChange={(e) => setEditItem(f => ({ ...f, descripcion: e.target.value }))} className="h-7 text-sm" /></td>
                      <td className="px-4 py-2"><Input value={editItem.unidad} onChange={(e) => setEditItem(f => ({ ...f, unidad: e.target.value }))} className="h-7 text-sm w-16 text-center" /></td>
                      <td className="px-4 py-2"><Input type="number" step="any" value={editItem.cantidad} onChange={(e) => setEditItem(f => ({ ...f, cantidad: e.target.value }))} className="h-7 text-sm text-right w-20" /></td>
                      <td className="px-4 py-2"><Input type="number" step="any" value={editItem.precioUnitario} onChange={(e) => setEditItem(f => ({ ...f, precioUnitario: e.target.value }))} className="h-7 text-sm text-right w-24" /></td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(parseFloat(editItem.cantidad || '0') * parseFloat(editItem.precioUnitario || '0'), orden.moneda)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleUpdateItem(item.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingItemId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={item.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 text-foreground">
                      {item.descripcion}
                      {item.observaciones && <p className="text-xs text-muted-foreground mt-0.5">{item.observaciones}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{item.unidad}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{item.cantidad}</td>
                    {!esBorrador && (
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <span className={item.cantidadRecibida >= item.cantidad ? 'text-green-600 font-medium' : item.cantidadRecibida > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                          {item.cantidadRecibida}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(item.precioUnitario, orden.moneda)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(item.subtotal, orden.moneda)}</td>
                    {esBorrador && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEditItem(item)} className="p-1 text-muted-foreground hover:text-blue-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-muted-foreground hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-muted/30">
              <tr>
                <td colSpan={esBorrador ? 4 : 5} className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Subtotal</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{fmt(orden.subtotal, orden.moneda)}</td>
                {esBorrador && <td></td>}
              </tr>
              <tr>
                <td colSpan={esBorrador ? 4 : 5} className="px-4 py-1 text-right text-xs text-muted-foreground">ITBIS</td>
                <td className="px-4 py-1 text-right tabular-nums text-muted-foreground">{fmt(orden.impuesto, orden.moneda)}</td>
                {esBorrador && <td></td>}
              </tr>
              <tr className="border-t border-border">
                <td colSpan={esBorrador ? 4 : 5} className="px-4 py-2 text-right text-sm font-bold text-foreground">Total</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold text-foreground text-base">{fmt(orden.total, orden.moneda)}</td>
                {esBorrador && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
