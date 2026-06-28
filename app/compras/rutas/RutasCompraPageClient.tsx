'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Route, Plus, Search, MapPin, Package } from 'lucide-react'

interface Ruta {
  id: number
  codigo: string
  titulo: string | null
  fecha: string
  estado: string
  comprador: string | null
  numParadas: number
  numItems: number
  totalEstimado: number
  totalReal: number
}

const ESTADOS_BADGE: Record<string, { label: string; color: string }> = {
  borrador:   { label: 'Borrador',   color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  en_proceso: { label: 'En proceso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  cancelada:  { label: 'Cancelada',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

const FILTROS = ['todos', 'borrador', 'en_proceso', 'completada', 'cancelada']

function fmt(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function RutasCompraPageClient({ rutasIniciales }: { rutasIniciales: Ruta[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const filtradas = rutasIniciales.filter((r) => {
    if (filtro !== 'todos' && r.estado !== filtro) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return r.codigo.toLowerCase().includes(q) || (r.titulo ?? '').toLowerCase().includes(q) || (r.comprador ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Route className="w-6 h-6 text-blue-600" />
            Rutas de Compra
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Lista de materiales a comprar, agrupada por suplidor</p>
        </div>
        <Link href="/compras/rutas/nueva">
          <Button size="sm"><Plus className="w-4 h-4" /> Nueva ruta</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código, título, comprador..." className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filtro === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {f === 'todos' ? 'Todos' : ESTADOS_BADGE[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <Route className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Sin rutas de compra</p>
          <p className="text-xs text-muted-foreground mt-1">Crea tu primera ruta para organizar las compras del comprador</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Título</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Paradas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Items</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Estimado</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((r) => {
                const badge = ESTADOS_BADGE[r.estado] || { label: r.estado, color: 'bg-slate-100 text-slate-700' }
                return (
                  <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => router.push(`/compras/rutas/${r.id}`)}>
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{r.codigo}</td>
                    <td className="px-4 py-3 text-foreground">{r.titulo || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.fecha).toLocaleDateString('es-DO')}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1 justify-end"><MapPin className="w-3.5 h-3.5" />{r.numParadas}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground"><span className="inline-flex items-center gap-1 justify-end"><Package className="w-3.5 h-3.5" />{r.numItems}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(r.totalEstimado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{fmt(r.totalReal)}</td>
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
