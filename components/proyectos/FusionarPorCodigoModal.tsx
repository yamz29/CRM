'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Combine, AlertTriangle, Loader2, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface GrupoDuplicado {
  codigo: string
  cantidad: number
  totalSubtotal: number
  partidas: Array<{
    id: number
    codigo: string | null
    descripcion: string
    subtotalPresupuestado: number
    cantidad: number
    unidad: string
  }>
}

interface Props {
  proyectoId: number
  onClose: () => void
  onSuccess: () => void
}

export function FusionarPorCodigoModal({ proyectoId, onClose, onSuccess }: Props) {
  const [grupos, setGrupos] = useState<GrupoDuplicado[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [fusionando, setFusionando] = useState(false)

  useEffect(() => {
    fetch(`/api/proyectos/${proyectoId}/partidas/merge-auto`)
      .then(r => r.json())
      .then(d => {
        setGrupos(d.grupos || [])
        // Por defecto, todos seleccionados
        setSeleccionados(new Set((d.grupos || []).map((g: GrupoDuplicado) => g.codigo)))
        setLoading(false)
      })
  }, [proyectoId])

  function toggleCodigo(codigo: string) {
    setSeleccionados(prev => {
      const n = new Set(prev)
      if (n.has(codigo)) n.delete(codigo)
      else n.add(codigo)
      return n
    })
  }

  async function handleFusionar() {
    if (seleccionados.size === 0) return
    setFusionando(true)
    const res = await fetch(`/api/proyectos/${proyectoId}/partidas/merge-auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigos: Array.from(seleccionados) }),
    })
    if (res.ok) {
      onSuccess()
      onClose()
    } else {
      alert('Error al fusionar las partidas')
      setFusionando(false)
    }
  }

  const totalAfectadas = grupos
    .filter(g => seleccionados.has(g.codigo))
    .reduce((s, g) => s + g.cantidad, 0)
  const totalResultantes = grupos.filter(g => seleccionados.has(g.codigo)).length
  const totalAEliminar = totalAfectadas - totalResultantes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Combine className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Fusionar partidas por código</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Analizando partidas...
          </div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
            <p className="text-base font-semibold text-foreground">No hay partidas duplicadas por código</p>
            <p className="text-sm text-muted-foreground mt-1">
              Todas las partidas de este proyecto ya tienen códigos únicos.
            </p>
            <Button variant="secondary" onClick={onClose} className="mt-4">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <p><strong>¿Qué hace?</strong> Fusiona todas las partidas que comparten el mismo código en una sola, sumando cantidades y subtotales. Los gastos registrados se conservan y se reasignan a la partida resultante.</p>
                  <p>Se eligirá como destino la primera partida del grupo (menor orden).</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {grupos.map(g => {
                const activo = seleccionados.has(g.codigo)
                return (
                  <div
                    key={g.codigo}
                    className={`border-2 rounded-lg p-3 transition-colors ${
                      activo ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => toggleCodigo(g.codigo)}
                        className="mt-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{g.codigo}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              {g.cantidad} partidas → 1 resultante
                            </span>
                          </div>
                          <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(g.totalSubtotal)}</span>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {g.partidas.map((p, i) => (
                            <li key={p.id} className={`text-xs flex items-center gap-2 ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              <span className="shrink-0 w-16">{i === 0 ? '→ Destino' : 'Fuente'}</span>
                              <span className="truncate flex-1">{p.descripcion}</span>
                              <span className="tabular-nums shrink-0">{formatCurrency(p.subtotalPresupuestado)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Se fusionarán <strong>{totalAfectadas}</strong> partidas en <strong>{totalResultantes}</strong> ({totalAEliminar} se eliminarán, los gastos se conservan)
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose} disabled={fusionando}>Cancelar</Button>
                <Button size="sm" onClick={handleFusionar} disabled={fusionando || seleccionados.size === 0}>
                  {fusionando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fusionando...</> : <><Combine className="w-3.5 h-3.5" /> Fusionar {seleccionados.size} grupo{seleccionados.size === 1 ? '' : 's'}</>}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
