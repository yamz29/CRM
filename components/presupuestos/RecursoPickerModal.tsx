'use client'

import { useState, useEffect } from 'react'
import { Search, X, Package, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Recurso {
  id: number
  codigo: string | null
  nombre: string
  tipo: string
  unidad: string
  costoUnitario: number
}

interface Props {
  onSelect: (recurso: Recurso) => void
  onClose: () => void
}

const TIPO_LABELS: Record<string, string> = {
  materiales: 'Materiales',
  manoObra: 'Mano de Obra',
  equipos: 'Equipos',
  herramientas: 'Herramientas',
  subcontratos: 'Subcontratos',
  transportes: 'Transportes',
  herrajes: 'Herrajes',
  consumibles: 'Consumibles',
}

export function RecursoPickerModal({ onSelect, onClose }: Props) {
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/recursos?activo=true')
      .then((r) => r.json())
      .then(setRecursos)
      .finally(() => setLoading(false))
  }, [])

  const filtered = recursos.filter((r) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      r.nombre.toLowerCase().includes(q) ||
      (r.codigo?.toLowerCase().includes(q) ?? false) ||
      r.tipo.toLowerCase().includes(q)
    )
  })

  // Group by tipo
  const grouped = filtered.reduce<Record<string, Recurso[]>>((acc, r) => {
    const key = r.tipo
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Catálogo de Recursos</h2>
                <p className="text-xs text-muted-foreground">Selecciona para auto-completar la línea</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-2.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, código o tipo..."
                autoFocus
                className="w-full pl-8 pr-4 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">Cargando recursos...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground text-sm">No se encontraron recursos</p>
              </div>
            )}
            {!loading && Object.entries(grouped).map(([tipo, items]) => (
              <div key={tipo}>
                <div className="sticky top-0 px-5 py-1 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {TIPO_LABELS[tipo] ?? tipo}
                </div>
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { onSelect(r); onClose() }}
                    className="w-full flex items-center gap-3 px-5 py-2.5 border-b border-border text-left hover:bg-blue-50 transition-colors group"
                  >
                    <Check className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {r.codigo && <span className="text-xs font-mono text-muted-foreground">{r.codigo}</span>}
                        <span className="text-sm font-medium text-foreground truncate">{r.nombre}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{r.unidad}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(r.costoUnitario)}</p>
                      <p className="text-xs text-muted-foreground">/{r.unidad}</p>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-muted/40 flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </>
  )
}
