'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Search, X } from 'lucide-react'
import { DeleteRecursoButton } from '@/app/recursos/DeleteRecursoButton'
import { Pencil } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  materiales:   'Materiales',
  manoObra:     'Mano de Obra',
  equipos:      'Equipos',
  herramientas: 'Herramientas',
  subcontratos: 'Subcontratos',
  transportes:  'Transportes',
  herrajes:     'Herrajes',
  consumibles:  'Consumibles',
}

const TIPO_COLORS: Record<string, string> = {
  materiales:   'bg-orange-100 text-orange-700',
  manoObra:     'bg-blue-100 text-blue-700',
  equipos:      'bg-purple-100 text-purple-700',
  herramientas: 'bg-slate-100 text-slate-700',
  subcontratos: 'bg-pink-100 text-pink-700',
  transportes:  'bg-teal-100 text-teal-700',
  herrajes:     'bg-amber-100 text-amber-700',
  consumibles:  'bg-green-100 text-green-700',
}

interface Recurso {
  id: number
  codigo: string | null
  nombre: string
  tipo: string
  categoria: string | null
  subcategoria: string | null
  unidad: string
  costoUnitario: number
  proveedor: string | null
  activo: boolean
}

export function RecursosTable({ recursos }: { recursos: Recurso[] }) {
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return recursos.filter((r) => {
      if (tipoFilter && r.tipo !== tipoFilter) return false
      if (soloActivos && !r.activo) return false
      if (!q) return true
      return (
        r.nombre.toLowerCase().includes(q) ||
        (r.codigo?.toLowerCase().includes(q) ?? false) ||
        (r.categoria?.toLowerCase().includes(q) ?? false) ||
        (r.subcategoria?.toLowerCase().includes(q) ?? false) ||
        r.unidad.toLowerCase().includes(q)
      )
    })
  }, [recursos, search, tipoFilter, soloActivos])

  const grouped = filtered.reduce<Record<string, Recurso[]>>((acc, r) => {
    if (!acc[r.tipo]) acc[r.tipo] = []
    acc[r.tipo].push(r)
    return acc
  }, {})

  const tipos = Array.from(new Set(recursos.map((r) => r.tipo))).sort()

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <Card>
        <CardContent className="py-3 space-y-3">
          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre, categoría, unidad..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tipo tabs + activo filter */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTipoFilter('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipoFilter === '' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Todos
            </button>
            {tipos.map((t) => (
              <button key={t}
                onClick={() => setTipoFilter(tipoFilter === t ? '' : t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipoFilter === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {TIPO_LABELS[t] || t}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded" />
              Solo activos
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      {search && (
        <p className="text-sm text-slate-500 px-1">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
          <Package className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron recursos</p>
          {search && <button onClick={() => setSearch('')} className="mt-2 text-sm text-blue-600 hover:underline">Limpiar búsqueda</button>}
        </div>
      )}

      {/* Grouped tables */}
      {Object.entries(grouped).map(([tipoKey, items]) => (
        <Card key={tipoKey} className="overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIPO_COLORS[tipoKey] || 'bg-slate-100 text-slate-600'}`}>
              {TIPO_LABELS[tipoKey] || tipoKey}
            </span>
            <span className="text-xs text-slate-400">{items.length} registro{items.length !== 1 ? 's' : ''}</span>
          </div>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-24">Código</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-28">Categoría</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-16">Unidad</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-32">Costo Unit.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-28">Proveedor</th>
                  <th className="px-4 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((r, idx) => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-2 text-xs font-mono text-slate-400">{r.codigo || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="text-sm font-medium text-slate-800">{r.nombre}</span>
                      {!r.activo && <span className="ml-2 text-xs text-slate-400">(inactivo)</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500">{r.categoria || '—'}</td>
                    <td className="px-4 py-2 text-sm text-slate-600 text-center">{r.unidad}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-slate-800 text-right">{formatCurrency(r.costoUnitario)}</td>
                    <td className="px-4 py-2 text-sm text-slate-500">{r.proveedor || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/recursos/${r.id}/editar`}>
                          <button className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                        <DeleteRecursoButton id={r.id} nombre={r.nombre} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
