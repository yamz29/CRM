'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Search, X, FileSpreadsheet, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ApuResult {
  id: number
  codigo?: string | null
  nombre: string
  descripcion?: string | null
  capitulo?: string | null
  unidad: string
  costoDirecto: number
  precioVenta: number
  indirectos: number
  utilidad: number
  recursos: Array<{
    recursoId: number
    cantidad: number
    costoSnapshot: number
    subtotal: number
    recurso: {
      nombre: string
      tipo: string
      unidad: string
    }
  }>
}

interface InsertedPartida {
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  observaciones: string
  orden: number
  analisis: {
    materiales: number
    manoObra: number
    equipos: number
    subcontratos: number
    transporte: number
    desperdicio: number
    indirectos: number
    utilidad: number
    costoDirecto: number
    costoTotal: number
    precioSugerido: number
    margen: number
    detalle: {
      materiales: Array<{ descripcion: string; unidad: string; cantidad: number; precioUnitario: number }>
      manoObra: Array<{ descripcion: string; unidad: string; cantidad: number; precioUnitario: number }>
      equipos: Array<{ descripcion: string; unidad: string; cantidad: number; precioUnitario: number }>
      subcontratos: Array<{ descripcion: string; unidad: string; cantidad: number; precioUnitario: number }>
      transporte: Array<{ descripcion: string; unidad: string; cantidad: number; precioUnitario: number }>
    }
  }
}

interface Props {
  onInsert: (partida: InsertedPartida, orden: number) => void
  onClose: () => void
  currentOrden: number
}

const TIPO_TO_SECCION: Record<string, keyof InsertedPartida['analisis']['detalle']> = {
  materiales:   'materiales',
  herrajes:     'materiales',
  consumibles:  'materiales',
  manoObra:     'manoObra',
  equipos:      'equipos',
  herramientas: 'equipos',
  subcontratos: 'subcontratos',
  transportes:  'transporte',
}

function buildPartidaFromApu(apu: ApuResult, cantidad: number, orden: number): InsertedPartida {
  const costoTotal = apu.costoDirecto * (1 + apu.indirectos / 100)
  const precioSugerido = apu.precioVenta
  const margen = precioSugerido > 0 ? ((precioSugerido - apu.costoDirecto) / precioSugerido) * 100 : 0

  // Group resources into detalle sections
  const detalle: InsertedPartida['analisis']['detalle'] = {
    materiales: [], manoObra: [], equipos: [], subcontratos: [], transporte: []
  }
  let mat = 0, mo = 0, eq = 0, sub = 0, tra = 0

  for (const ar of apu.recursos) {
    const seccion = TIPO_TO_SECCION[ar.recurso.tipo] || 'materiales'
    detalle[seccion].push({
      descripcion: ar.recurso.nombre,
      unidad: ar.recurso.unidad,
      cantidad: ar.cantidad,
      precioUnitario: ar.costoSnapshot,
    })
    if (seccion === 'materiales') mat += ar.subtotal
    else if (seccion === 'manoObra') mo += ar.subtotal
    else if (seccion === 'equipos') eq += ar.subtotal
    else if (seccion === 'subcontratos') sub += ar.subtotal
    else if (seccion === 'transporte') tra += ar.subtotal
  }

  return {
    codigo: apu.codigo || '',
    descripcion: apu.nombre,
    unidad: apu.unidad,
    cantidad,
    precioUnitario: apu.precioVenta,
    subtotal: cantidad * apu.precioVenta,
    observaciones: '',
    orden,
    analisis: {
      materiales: mat, manoObra: mo, equipos: eq,
      subcontratos: sub, transporte: tra, desperdicio: 0,
      indirectos: apu.indirectos, utilidad: apu.utilidad,
      costoDirecto: apu.costoDirecto, costoTotal, precioSugerido, margen,
      detalle,
    },
  }
}

export function ApuSearchModal({ onInsert, onClose, currentOrden }: Props) {
  const [query, setQuery] = useState('')
  const [apus, setApus] = useState<ApuResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApuResult | null>(null)
  const [cantidad, setCantidad] = useState(1)

  // Load all active APUs on mount
  useEffect(() => {
    fetch('/api/apus?withRecursos=true')
      .then((r) => r.json())
      .then(setApus)
      .finally(() => setLoading(false))
  }, [])

  const filtered = apus.filter((a) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      a.nombre.toLowerCase().includes(q) ||
      (a.codigo?.toLowerCase().includes(q) ?? false) ||
      (a.capitulo?.toLowerCase().includes(q) ?? false) ||
      (a.descripcion?.toLowerCase().includes(q) ?? false)
    )
  })

  const handleInsert = () => {
    if (!selected) return
    onInsert(buildPartidaFromApu(selected, cantidad, currentOrden), currentOrden)
    onClose()
  }

  // Group filtered by capitulo
  const grouped = filtered.reduce<Record<string, ApuResult[]>>((acc, a) => {
    const key = a.capitulo || 'Sin capítulo'
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Catálogo de APUs</h2>
                <p className="text-xs text-muted-foreground">Selecciona un APU para insertarlo como partida</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, código o capítulo..."
                autoFocus
                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Cargando APUs...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No se encontraron APUs</p>
                {query && <p className="text-muted-foreground text-xs mt-1">Intenta con otra búsqueda</p>}
              </div>
            )}

            {!loading && Object.entries(grouped).map(([cap, items]) => (
              <div key={cap}>
                <div className="sticky top-0 px-6 py-1.5 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {cap}
                </div>
                {items.map((apu) => {
                  const isSelected = selected?.id === apu.id
                  return (
                    <button
                      key={apu.id}
                      onClick={() => setSelected(isSelected ? null : apu)}
                      className={`w-full flex items-center gap-4 px-6 py-3 border-b border-border text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-blue-100'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-border'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {apu.codigo && (
                            <span className="text-xs font-mono text-muted-foreground">{apu.codigo}</span>
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{apu.nombre}</span>
                        </div>
                        {apu.descripcion && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{apu.descripcion}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {apu.recursos.length} recurso{apu.recursos.length !== 1 ? 's' : ''} · {apu.unidad}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Precio venta</p>
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(apu.precioVenta)}</p>
                        <p className="text-xs text-muted-foreground">/{apu.unidad}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer: quantity + insert */}
          <div className="px-6 py-4 border-t border-border bg-muted/40">
            {selected ? (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">APU seleccionado</p>
                  <p className="text-sm font-semibold text-foreground truncate">{selected.nombre}</p>
                  <p className="text-xs text-blue-600">{formatCurrency(selected.precioVenta)} / {selected.unidad}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Cantidad:</label>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(parseFloat(e.target.value) || 1)}
                    min="0.001"
                    step="0.5"
                    className="w-20 border border-border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">{selected.unidad}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(cantidad * selected.precioVenta)}</p>
                </div>
                <Button onClick={handleInsert} className="flex-shrink-0">
                  <Check className="w-4 h-4" /> Insertar partida
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Selecciona un APU de la lista para continuar</p>
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
