'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Loader2 } from 'lucide-react'

interface Material {
  id: number
  nombre: string
  tipo: string | null
  unidad: string
  cantidadRequerida: number
  cantidadComprada: number
  cantidadRecibida: number
  costoUnitario: number
  costoTotal: number
  proveedor: string | null
  estado: string
}

interface Props {
  ordenId: number
  materiales: Material[]
}

const ESTADO_MAT_COLORS: Record<string, string> = {
  'Pendiente': 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400',
  'Comprado':  'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  'Recibido':  'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  'Parcial':   'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
}

export function MaterialesList({ ordenId, materiales }: Props) {
  const router = useRouter()
  const [edits, setEdits] = useState<Record<number, Partial<Material>>>({})
  const [saving, setSaving] = useState(false)

  function updateField(id: number, field: string, value: string | number) {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const hasChanges = Object.keys(edits).length > 0

  async function handleSave() {
    setSaving(true)
    const updates = Object.entries(edits).map(([id, changes]) => ({
      id: parseInt(id),
      ...changes,
    }))

    await fetch(`/api/produccion/${ordenId}/materiales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })

    setEdits({})
    router.refresh()
    setSaving(false)
  }

  const totalRequerido = materiales.reduce((s, m) => s + m.costoTotal, 0)
  const totalComprado = materiales
    .filter(m => m.estado !== 'Pendiente')
    .reduce((s, m) => s + (m.cantidadComprada * m.costoUnitario), 0)

  if (materiales.length === 0) {
    return (
      <Card>
        <div className="py-12 text-center text-muted-foreground">
          <p>No hay materiales en esta orden</p>
          <p className="text-xs mt-1">Los materiales se generan automáticamente al importar módulos de un presupuesto</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4 bg-card border border-border dark:bg-white/[0.03] dark:border-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total Requerido</p>
          <p className="text-xl font-bold text-foreground mt-1">
            RD${totalRequerido.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl p-4 bg-card border border-border dark:bg-white/[0.03] dark:border-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total Comprado</p>
          <p className="text-xl font-bold text-foreground mt-1">
            RD${totalComprado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl p-4 bg-card border border-border dark:bg-white/[0.03] dark:border-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Items</p>
          <p className="text-xl font-bold text-foreground mt-1">{materiales.length}</p>
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Material</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Requerido</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Comprado</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Recibido</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Costo Unit.</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Subtotal</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => {
                const edit = edits[m.id] || {}
                const comprada = edit.cantidadComprada ?? m.cantidadComprada
                const recibida = edit.cantidadRecibida ?? m.cantidadRecibida
                const estado = (edit.estado as string) ?? m.estado

                return (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-foreground">{m.nombre}</p>
                      {m.proveedor && <p className="text-xs text-muted-foreground">{m.proveedor}</p>}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground capitalize">{m.tipo || '-'}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="font-medium text-foreground">{m.cantidadRequerida}</span>
                      <span className="text-muted-foreground ml-1">{m.unidad}</span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={comprada}
                        onChange={(e) => updateField(m.id, 'cantidadComprada', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded border border-border bg-input text-foreground text-sm text-center"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={recibida}
                        onChange={(e) => updateField(m.id, 'cantidadRecibida', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded border border-border bg-input text-foreground text-sm text-center"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      RD${m.costoUnitario.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-foreground">
                      RD${m.costoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <select
                        value={estado}
                        onChange={(e) => updateField(m.id, 'estado', e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${ESTADO_MAT_COLORS[estado] || ''}`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Comprado">Comprado</option>
                        <option value="Parcial">Parcial</option>
                        <option value="Recibido">Recibido</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {hasChanges && (
          <div className="flex justify-end px-4 py-3 border-t border-border">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
