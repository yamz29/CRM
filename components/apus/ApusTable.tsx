'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { FileSpreadsheet, Search, X, Eye, Pencil } from 'lucide-react'
import { DeleteApuButton } from '@/app/apus/DeleteApuButton'

interface Apu {
  id: number
  codigo: string | null
  nombre: string
  descripcion: string | null
  capitulo: string | null
  unidad: string
  costoDirecto: number
  precioVenta: number
  activo: boolean
  _count: { recursos: number }
}

export function ApusTable({ apus }: { apus: Apu[] }) {
  const [search, setSearch] = useState('')
  const [capFilter, setCapFilter] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return apus.filter((a) => {
      if (capFilter && (a.capitulo || 'Sin capítulo') !== capFilter) return false
      if (soloActivos && !a.activo) return false
      if (!q) return true
      return (
        a.nombre.toLowerCase().includes(q) ||
        (a.codigo?.toLowerCase().includes(q) ?? false) ||
        (a.descripcion?.toLowerCase().includes(q) ?? false) ||
        (a.capitulo?.toLowerCase().includes(q) ?? false) ||
        a.unidad.toLowerCase().includes(q)
      )
    })
  }, [apus, search, capFilter, soloActivos])

  const grouped = filtered.reduce<Record<string, Apu[]>>((acc, a) => {
    const key = a.capitulo || 'Sin capítulo'
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  const capitulos = Array.from(new Set(apus.map((a) => a.capitulo || 'Sin capítulo'))).sort()

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <Card>
        <CardContent className="py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre, capítulo, descripción, unidad..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCapFilter('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${capFilter === '' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              Todos
            </button>
            {capitulos.map((c) => (
              <button key={c}
                onClick={() => setCapFilter(capFilter === c ? '' : c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${capFilter === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {c}
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

      {search && (
        <p className="text-sm text-slate-500 px-1">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &ldquo;{search}&rdquo;
        </p>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron APUs</p>
          {search && <button onClick={() => setSearch('')} className="mt-2 text-sm text-blue-600 hover:underline">Limpiar búsqueda</button>}
        </div>
      )}

      {Object.entries(grouped).map(([cap, items]) => (
        <Card key={cap} className="overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800 text-white flex items-center gap-2">
            <span className="text-sm font-semibold">{cap}</span>
            <span className="text-xs text-slate-400">{items.length} APU{items.length !== 1 ? 's' : ''}</span>
          </div>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-24">Código</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-16">Unidad</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Recursos</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-32">Costo Directo</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-32 bg-blue-50">Precio Venta</th>
                  <th className="px-4 py-2 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((apu, idx) => (
                  <tr key={apu.id} className={`hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{apu.codigo || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/apus/${apu.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                        {apu.nombre}
                      </Link>
                      {!apu.activo && <span className="ml-2 text-xs text-slate-400">(inactivo)</span>}
                      {apu.descripcion && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{apu.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 text-center">{apu.unidad}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                        {apu._count.recursos}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700 text-right">{formatCurrency(apu.costoDirecto)}</td>
                    <td className="px-4 py-2.5 text-sm font-bold text-blue-700 text-right bg-blue-50/30">{formatCurrency(apu.precioVenta)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/apus/${apu.id}`}>
                          <button className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver / Editar">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                        <Link href={`/apus/${apu.id}`}>
                          <button className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                        <DeleteApuButton id={apu.id} nombre={apu.nombre} />
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
