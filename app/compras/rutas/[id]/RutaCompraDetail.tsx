'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Route, MapPin, Phone, Printer, Building2 } from 'lucide-react'

interface Item {
  id: number
  descripcion: string
  cantidad: number
  unidad: string
  urgencia: string
  precioEstimado: number | null
  precioReal: number | null
  comprado: boolean
  proveedorId: number | null
  proveedorTexto: string | null
  proveedor: { id: number; nombre: string; direccion: string | null; telefono: string | null } | null
  proyecto: { id: number; nombre: string } | null
}

interface Ruta {
  id: number
  codigo: string
  titulo: string | null
  fecha: string
  estado: string
  comprador: string | null
  notas: string | null
  items: Item[]
}

const URGENCIA_BADGE: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  baja: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const ESTADOS = ['borrador', 'en_proceso', 'completada', 'cancelada']
const ESTADO_LABEL: Record<string, string> = { borrador: 'Borrador', en_proceso: 'En proceso', completada: 'Completada', cancelada: 'Cancelada' }

function fmt(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function paradaKey(it: Item) {
  if (it.proveedorId) return `id:${it.proveedorId}`
  if (it.proveedorTexto) return `t:${it.proveedorTexto}`
  return 'sin'
}

export function RutaCompraDetail({ rutaInicial }: { rutaInicial: Ruta }) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState<Item[]>(rutaInicial.items)
  const [estado, setEstado] = useState(rutaInicial.estado)

  // Agrupar items por suplidor (parada)
  const paradas = useMemo(() => {
    const map = new Map<string, { nombre: string; direccion: string | null; telefono: string | null; items: Item[] }>()
    for (const it of items) {
      const key = paradaKey(it)
      if (!map.has(key)) {
        map.set(key, {
          nombre: it.proveedor?.nombre || it.proveedorTexto || 'Sin suplidor asignado',
          direccion: it.proveedor?.direccion || null,
          telefono: it.proveedor?.telefono || null,
          items: [],
        })
      }
      map.get(key)!.items.push(it)
    }
    return Array.from(map.values())
  }, [items])

  const totalEstimado = items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
  const totalReal = items.reduce((s, i) => s + (i.precioReal ?? 0), 0)
  const comprados = items.filter((i) => i.comprado).length

  async function patchItem(itemId: number, patch: { comprado?: boolean; precioReal?: number | null }) {
    setItems((its) => its.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
    try {
      const res = await fetch(`/api/compras/rutas/${rutaInicial.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('No se pudo guardar el cambio')
    }
  }

  async function cambiarEstado(nuevo: string) {
    setEstado(nuevo)
    try {
      const res = await fetch(`/api/compras/rutas/${rutaInicial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevo }),
      })
      if (!res.ok) throw new Error()
      toast.exito('Estado actualizado')
    } catch {
      toast.error('No se pudo cambiar el estado')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Route className="w-6 h-6 text-blue-600" /> {rutaInicial.codigo}
          </h1>
          {rutaInicial.titulo && <p className="text-sm text-muted-foreground mt-1">{rutaInicial.titulo}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(rutaInicial.fecha).toLocaleDateString('es-DO')}
            {rutaInicial.comprador && ` · Comprador: ${rutaInicial.comprador}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={estado} onChange={(e) => cambiarEstado(e.target.value)} className="h-9 text-sm border border-border rounded-md px-3 bg-card">
            {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
          <Button variant="secondary" size="sm" onClick={() => window.open(`/compras/rutas/${rutaInicial.id}/imprimir`, '_blank')}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Paradas</p><p className="text-xl font-bold text-foreground">{paradas.length}</p></div>
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Comprados</p><p className="text-xl font-bold text-foreground">{comprados}/{items.length}</p></div>
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Estimado</p><p className="text-xl font-bold text-muted-foreground">{fmt(totalEstimado)}</p></div>
        <div className="border border-border rounded-xl p-3 bg-card"><p className="text-xs text-muted-foreground">Real</p><p className="text-xl font-bold text-green-600">{fmt(totalReal)}</p></div>
      </div>

      {paradas.map((parada, pi) => {
        const subEst = parada.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
        const subReal = parada.items.reduce((s, i) => s + (i.precioReal ?? 0), 0)
        return (
          <div key={pi} className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 font-semibold text-foreground"><MapPin className="w-4 h-4 text-blue-600" /> {parada.nombre}</div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                {parada.direccion && <span>{parada.direccion}</span>}
                {parada.telefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {parada.telefono}</span>}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-center w-10">✓</th>
                  <th className="px-3 py-2 text-left">Material</th>
                  <th className="px-3 py-2 text-left w-36">Proyecto</th>
                  <th className="px-3 py-2 text-center w-20">Cant.</th>
                  <th className="px-3 py-2 text-center w-20">Urgencia</th>
                  <th className="px-3 py-2 text-right w-28">Estimado</th>
                  <th className="px-3 py-2 text-right w-32">Precio real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parada.items.map((it) => (
                  <tr key={it.id} className={it.comprado ? 'bg-green-50/50 dark:bg-green-900/10' : ''}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={it.comprado} onChange={(e) => patchItem(it.id, { comprado: e.target.checked })} className="w-4 h-4 accent-green-600" />
                    </td>
                    <td className="px-3 py-2 text-foreground font-medium">{it.descripcion}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{it.proyecto ? <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{it.proyecto.nombre}</span> : '—'}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{it.cantidad} {it.unidad}</td>
                    <td className="px-3 py-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${URGENCIA_BADGE[it.urgencia] || URGENCIA_BADGE.media}`}>{it.urgencia}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{it.precioEstimado != null ? fmt(it.precioEstimado) : '—'}</td>
                    <td className="px-3 py-2">
                      <Input type="number" step="0.01" defaultValue={it.precioReal ?? ''} onBlur={(e) => patchItem(it.id, { precioReal: e.target.value === '' ? null : parseFloat(e.target.value) })} className="h-8 text-sm text-right" placeholder="0.00" />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border text-xs">
                  <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground font-medium">Subtotal parada:</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmt(subEst)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{fmt(subReal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })}

      <div className="flex">
        <Button variant="secondary" size="sm" onClick={() => router.push('/compras/rutas')}>Volver a rutas</Button>
      </div>
    </div>
  )
}
