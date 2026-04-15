'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { X, Wand2, AlertTriangle, Info } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Props {
  presupuestos: { id: number; numero: string; total: number }[]
  onGenerar: (presupuestoId: number) => Promise<void>
  onClose: () => void
  loading: boolean
}

export function GenerarModal({ presupuestos, onGenerar, onClose, loading }: Props) {
  const [presupuestoId, setPresupuestoId] = useState(presupuestos[0]?.id ? String(presupuestos[0].id) : '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-foreground">Importar trabajos del presupuesto</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <Label>Presupuesto</Label>
          <select value={presupuestoId} onChange={e => setPresupuestoId(e.target.value)}
            className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
            {presupuestos.map(p => (
              <option key={p.id} value={p.id}>
                {p.numero} — {formatCurrency(p.total)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
            <p>Se importarán las partidas como actividades en una lista.</p>
            <p>Las <strong>fechas, duración, WBS y dependencias</strong> las defines tú manualmente después.</p>
          </div>
        </div>

        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Esto eliminará y recreará todas las actividades actuales del cronograma.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => onGenerar(parseInt(presupuestoId))}
            disabled={loading || !presupuestoId}
            className="flex-1"
          >
            {loading ? 'Importando…' : 'Importar trabajos'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
