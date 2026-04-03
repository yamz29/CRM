'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react'
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
  herramientas: 'bg-muted text-foreground',
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
  controlarStock: boolean
  stock: number
  stockMinimo: number
}

type EstadoFilter = 'todos' | 'activos' | 'inactivos'

function SelectFilter({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
          value ? 'border-blue-400 bg-blue-50 text-blue-800 font-medium' : 'border-border text-muted-foreground bg-card'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  )
}

export function RecursosTable({ recursos }: { recursos: Recurso[] }) {
  const [search,        setSearch]        = useState('')
  const [tipoFilter,    setTipoFilter]    = useState('')
  const [catFilter,     setCatFilter]     = useState('')
  const [provFilter,    setProvFilter]    = useState('')
  const [estadoFilter,  setEstadoFilter]  = useState<EstadoFilter>('todos')
  const [precioMin,     setPrecioMin]     = useState('')
  const [precioMax,     setPrecioMax]     = useState('')
  const [showAdvanced,  setShowAdvanced]  = useState(false)

  // Derived option lists (distinct values from data)
  const tipos      = useMemo(() => Array.from(new Set(recursos.map(r => r.tipo))).sort(), [recursos])
  const categorias = useMemo(() => Array.from(new Set(recursos.map(r => r.categoria).filter(Boolean) as string[])).sort(), [recursos])
  const proveedores = useMemo(() => Array.from(new Set(recursos.map(r => r.proveedor).filter(Boolean) as string[])).sort(), [recursos])

  const filtered = useMemo(() => {
    const q    = search.toLowerCase().trim()
    const pMin = precioMin !== '' ? parseFloat(precioMin) : null
    const pMax = precioMax !== '' ? parseFloat(precioMax) : null

    return recursos.filter(r => {
      if (tipoFilter   && r.tipo !== tipoFilter)            return false
      if (catFilter    && r.categoria !== catFilter)        return false
      if (provFilter   && r.proveedor !== provFilter)       return false
      if (estadoFilter === 'activos'   && !r.activo)        return false
      if (estadoFilter === 'inactivos' &&  r.activo)        return false
      if (pMin !== null && r.costoUnitario < pMin)          return false
      if (pMax !== null && r.costoUnitario > pMax)          return false
      if (!q) return true
      return (
        r.nombre.toLowerCase().includes(q) ||
        (r.codigo?.toLowerCase().includes(q)      ?? false) ||
        (r.categoria?.toLowerCase().includes(q)   ?? false) ||
        (r.subcategoria?.toLowerCase().includes(q)?? false) ||
        (r.proveedor?.toLowerCase().includes(q)   ?? false) ||
        r.unidad.toLowerCase().includes(q)
      )
    })
  }, [recursos, search, tipoFilter, catFilter, provFilter, estadoFilter, precioMin, precioMax])

  const grouped = useMemo(() =>
    filtered.reduce<Record<string, Recurso[]>>((acc, r) => {
      if (!acc[r.tipo]) acc[r.tipo] = []
      acc[r.tipo].push(r)
      return acc
    }, {})
  , [filtered])

  // Active filter chips (excluding search & tipo)
  const activeChips: { label: string; clear: () => void }[] = []
  if (catFilter)               activeChips.push({ label: `Cat: ${catFilter}`,    clear: () => setCatFilter('') })
  if (provFilter)              activeChips.push({ label: `Prov: ${provFilter}`,  clear: () => setProvFilter('') })
  if (estadoFilter !== 'todos') activeChips.push({ label: estadoFilter === 'activos' ? 'Solo activos' : 'Solo inactivos', clear: () => setEstadoFilter('todos') })
  if (precioMin !== '')        activeChips.push({ label: `Precio ≥ ${precioMin}`, clear: () => setPrecioMin('') })
  if (precioMax !== '')        activeChips.push({ label: `Precio ≤ ${precioMax}`, clear: () => setPrecioMax('') })

  const hasAnyFilter = search || tipoFilter || activeChips.length > 0

  function clearAll() {
    setSearch(''); setTipoFilter(''); setCatFilter(''); setProvFilter('')
    setEstadoFilter('todos'); setPrecioMin(''); setPrecioMax('')
  }

  return (
    <div className="space-y-4">
      {/* Filter panel */}
      <Card>
        <CardContent className="py-4 space-y-3">

          {/* Row 1: Search + advanced toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, nombre, categoría, proveedor..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                showAdvanced || activeChips.length > 0
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeChips.length > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {activeChips.length}
                </span>
              )}
            </button>
          </div>

          {/* Row 2: Tipo tabs */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTipoFilter('')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipoFilter === '' ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
            >
              Todos
            </button>
            {tipos.map(t => (
              <button key={t}
                onClick={() => setTipoFilter(tipoFilter === t ? '' : t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tipoFilter === t ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
              >
                {TIPO_LABELS[t] || t}
              </button>
            ))}
          </div>

          {/* Row 3: Advanced filters (collapsible) */}
          {showAdvanced && (
            <div className="pt-1 border-t border-border space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                {/* Categoría */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoría</label>
                  <SelectFilter value={catFilter} onChange={setCatFilter} options={categorias} placeholder="Todas" />
                </div>

                {/* Proveedor */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Proveedor</label>
                  <SelectFilter value={provFilter} onChange={setProvFilter} options={proveedores} placeholder="Todos" />
                </div>

                {/* Estado */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</label>
                  <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                    {(['todos', 'activos', 'inactivos'] as EstadoFilter[]).map(op => (
                      <button
                        key={op}
                        onClick={() => setEstadoFilter(op)}
                        className={`flex-1 py-2 capitalize transition-colors ${
                          estadoFilter === op ? 'bg-blue-600 text-white font-medium' : 'bg-card text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {op === 'todos' ? 'Todos' : op === 'activos' ? 'Activos' : 'Inactivos'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rango de precio */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Precio (RD$)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" placeholder="Mín"
                      value={precioMin}
                      onChange={e => setPrecioMin(e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-muted-foreground text-xs shrink-0">—</span>
                    <input
                      type="number" min="0" placeholder="Máx"
                      value={precioMax}
                      onChange={e => setPrecioMax(e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Filtros activos:</span>
              {activeChips.map(chip => (
                <span key={chip.label}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                  {chip.label}
                  <button onClick={chip.clear} className="hover:text-primary ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {hasAnyFilter && (
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-red-600 transition-colors underline ml-1">
                  Limpiar todo
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {filtered.length} recurso{filtered.length !== 1 ? 's' : ''}
          {hasAnyFilter && ` · ${recursos.length} total`}
        </p>
        {hasAnyFilter && !activeChips.length && search && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-muted-foreground underline">
            Limpiar búsqueda
          </button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl bg-muted/40 text-center">
          <Package className="w-12 h-12 text-muted-foreground/70 mb-3" />
          <p className="text-muted-foreground font-medium">No se encontraron recursos</p>
          <p className="text-muted-foreground text-sm mt-1">Intenta ajustando los filtros</p>
          {hasAnyFilter && (
            <button onClick={clearAll} className="mt-3 text-sm text-blue-600 hover:underline">
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}

      {/* Grouped tables */}
      {Object.entries(grouped).map(([tipoKey, items]) => (
        <Card key={tipoKey} className="overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TIPO_COLORS[tipoKey] || 'bg-muted text-muted-foreground'}`}>
              {TIPO_LABELS[tipoKey] || tipoKey}
            </span>
            <span className="text-xs text-muted-foreground">{items.length} registro{items.length !== 1 ? 's' : ''}</span>
          </div>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-24">Código</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Nombre</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Categoría</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-16">Unidad</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-32">Costo Unit.</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase w-28">Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Proveedor</th>
                  <th className="px-4 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((r, idx) => (
                  <tr key={r.id} className={`hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/40/30'}`}>
                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{r.codigo || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="text-sm font-medium text-foreground">{r.nombre}</span>
                      {!r.activo && <span className="ml-2 px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded">inactivo</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{r.categoria || '—'}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground text-center">{r.unidad}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-foreground text-right">{formatCurrency(r.costoUnitario)}</td>
                    <td className="px-4 py-2 text-center">
                      {r.controlarStock ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.stock <= 0
                            ? 'bg-red-100 text-red-700'
                            : r.stockMinimo > 0 && r.stock <= r.stockMinimo
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {r.stock} {r.unidad}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{r.proveedor || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/recursos/${r.id}/editar`}>
                          <button className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-blue-50 transition-colors">
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
