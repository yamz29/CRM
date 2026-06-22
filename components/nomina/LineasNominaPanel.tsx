'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, CheckCircle2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

interface Linea {
  id: number
  empleadoId: number
  empleadoNombre: string
  salarioBase: number
  horasExtra: number
  valorHoraExtra: number
  bonificaciones: number
  otrosDescuentos: number
  motivoDescuento: string | null
  afp: number
  sfs: number
  totalBruto: number
  totalNeto: number
}

export function LineasNominaPanel({
  periodoId,
  estado,
  lineas: lineasIniciales,
  esAdmin,
}: {
  periodoId: number
  estado: string
  lineas: Linea[]
  esAdmin: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [lineas, setLineas] = useState(lineasIniciales)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [marcandoPagada, setMarcandoPagada] = useState(false)

  const editable = estado === 'Borrador'
  const totalNeto = lineas.reduce((acc, l) => acc + l.totalNeto, 0)

  const updateLinea = (id: number, field: keyof Linea, value: string) => {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: field === 'motivoDescuento' ? value : parseFloat(value) || 0 } : l)))
  }

  const guardarLinea = async (linea: Linea) => {
    setSavingId(linea.id)
    try {
      const res = await fetch(`/api/nomina/periodos/${periodoId}/lineas/${linea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horasExtra: linea.horasExtra,
          bonificaciones: linea.bonificaciones,
          otrosDescuentos: linea.otrosDescuentos,
          motivoDescuento: linea.motivoDescuento,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const actualizada = await res.json()
      setLineas((prev) => prev.map((l) => (l.id === linea.id ? { ...l, ...actualizada } : l)))
      toast.exito('Línea actualizada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSavingId(null)
    }
  }

  const marcarPagada = async () => {
    setMarcandoPagada(true)
    try {
      const res = await fetch(`/api/nomina/periodos/${periodoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Pagada', fechaPago: new Date().toISOString() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      toast.exito('Período marcado como pagado')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setMarcandoPagada(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <a href={`/api/nomina/periodos/${periodoId}/plantilla`}>
          <Button variant="secondary"><Download className="w-4 h-4" /> Descargar plantilla de pago</Button>
        </a>
        {editable && (
          <Button onClick={marcarPagada} disabled={marcandoPagada}>
            <CheckCircle2 className="w-4 h-4" /> {marcandoPagada ? 'Guardando...' : 'Marcar como Pagada'}
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2.5">Empleado</th>
                <th className="text-right font-medium px-3 py-2.5">Salario base</th>
                <th className="text-right font-medium px-3 py-2.5">Horas extra</th>
                <th className="text-right font-medium px-3 py-2.5">Valor h. extra</th>
                <th className="text-right font-medium px-3 py-2.5">Bonificaciones</th>
                <th className="text-right font-medium px-3 py-2.5">AFP</th>
                <th className="text-right font-medium px-3 py-2.5">SFS</th>
                <th className="text-right font-medium px-3 py-2.5">Otros desc.</th>
                <th className="text-right font-medium px-3 py-2.5">Total neto</th>
                {editable && <th className="text-center font-medium px-3 py-2.5">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lineas.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-foreground font-medium whitespace-nowrap">{l.empleadoNombre}</td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">{formatCurrency(l.salarioBase)}</td>
                  <td className="px-3 py-2 text-right">
                    {editable ? (
                      <input type="number" min="0" step="0.5" value={l.horasExtra}
                        onChange={(e) => updateLinea(l.id, 'horasExtra', e.target.value)}
                        className="w-20 text-right border border-border rounded px-2 py-1 text-sm bg-card" />
                    ) : (
                      <span className="tabular-nums">{l.horasExtra}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">{formatCurrency(l.valorHoraExtra)}</td>
                  <td className="px-3 py-2 text-right">
                    {editable ? (
                      <input type="number" min="0" step="0.01" value={l.bonificaciones}
                        onChange={(e) => updateLinea(l.id, 'bonificaciones', e.target.value)}
                        className="w-24 text-right border border-border rounded px-2 py-1 text-sm bg-card" />
                    ) : (
                      <span className="tabular-nums">{formatCurrency(l.bonificaciones)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">{formatCurrency(l.afp)}</td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums">{formatCurrency(l.sfs)}</td>
                  <td className="px-3 py-2 text-right">
                    {editable ? (
                      <input type="number" min="0" step="0.01" value={l.otrosDescuentos}
                        onChange={(e) => updateLinea(l.id, 'otrosDescuentos', e.target.value)}
                        className="w-24 text-right border border-border rounded px-2 py-1 text-sm bg-card" />
                    ) : (
                      <span className="tabular-nums">{formatCurrency(l.otrosDescuentos)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground tabular-nums font-semibold">{formatCurrency(l.totalNeto)}</td>
                  {editable && (
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => guardarLinea(l)} disabled={savingId === l.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {lineas.length === 0 && (
                <tr>
                  <td colSpan={editable ? 10 : 9} className="text-center text-muted-foreground py-8">
                    Este período no tiene empleados con salario asignado
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={8} className="px-3 py-2.5 text-right font-semibold text-foreground">Total a pagar</td>
                <td className="px-3 py-2.5 text-right font-bold text-foreground tabular-nums">{formatCurrency(totalNeto)}</td>
                {editable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {!esAdmin && (
        <p className="text-xs text-muted-foreground">
          La plantilla descargada solo incluye los datos bancarios; el detalle salarial es visible únicamente para usuarios Admin.
        </p>
      )}
    </div>
  )
}
