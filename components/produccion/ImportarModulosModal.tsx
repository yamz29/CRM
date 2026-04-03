'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Modulo {
  id: number
  nombre: string
  tipoModulo: string
  ancho: number
  alto: number
  profundidad: number
  cantidad: number
  piezas: { id: number; nombre: string }[]
  materialesModulo: { material: { nombre: string; tipo: string } }[]
  materialTablero: { nombre: string } | null
}

interface Props {
  presupuestoId: number
  onClose: () => void
  onSelect?: (modulos: Modulo[]) => void
}

export function ImportarModulosModal({ presupuestoId, onClose, onSelect }: Props) {
  const [loading, setLoading] = useState(true)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [presupuesto, setPresupuesto] = useState<{ numero: string; cliente: { nombre: string } } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch('/api/produccion/importar-modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presupuestoId }),
    })
      .then(r => r.json())
      .then(data => {
        setModulos(data.modulos || [])
        setPresupuesto(data.presupuesto || null)
        setSelected(new Set((data.modulos || []).map((m: Modulo) => m.id)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [presupuestoId])

  function toggleAll() {
    if (selected.size === modulos.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(modulos.map(m => m.id)))
    }
  }

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Módulos disponibles</h3>
            {presupuesto && (
              <p className="text-xs text-muted-foreground">
                {presupuesto.numero} — {presupuesto.cliente.nombre}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[55vh] p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : modulos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay módulos en este presupuesto
            </p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === modulos.length}
                  onChange={toggleAll}
                  className="accent-primary"
                />
                Seleccionar todos ({modulos.length})
              </label>
              {modulos.map(m => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selected.has(m.id)
                      ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
                      : 'border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="accent-primary mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{m.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.tipoModulo} — {m.ancho}×{m.alto}×{m.profundidad} cm — Cant: {m.cantidad}
                    </p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {m.piezas.length} piezas
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {m.materialesModulo.length} materiales
                      </span>
                      {m.materialTablero && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {m.materialTablero.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {selected.size} de {modulos.length} seleccionados
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => {
                if (onSelect) onSelect(modulos.filter(m => selected.has(m.id)))
                onClose()
              }}
              disabled={selected.size === 0}
            >
              Importar {selected.size} módulos
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
