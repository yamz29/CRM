'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Plus, CheckCircle2, Clock, AlertCircle, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'

interface FacturaResumen {
  id: number
  numero: string
  ncf: string | null
  esProforma: boolean
  fecha: string | Date
  total: number
  montoPagado: number
  estado: string
}

interface Props {
  presupuestoId: number
  presupuestoEstado: string
  presupuestoTotal: number
  facturas: FacturaResumen[]
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  parcial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pagada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  anulada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function FacturacionPresupuesto({ presupuestoId, presupuestoEstado, presupuestoTotal, facturas }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  const estadosFacturables = ['Aprobado', 'En Ejecución', 'Ejecutado', 'Facturado', 'Cerrado']
  const puedeFacturar = estadosFacturables.includes(presupuestoEstado)

  const facturadoTotal = facturas
    .filter(f => f.estado !== 'anulada')
    .reduce((s, f) => s + f.total, 0)
  const cobradoTotal = facturas
    .filter(f => f.estado !== 'anulada')
    .reduce((s, f) => s + f.montoPagado, 0)
  const pendiente = Math.max(0, presupuestoTotal - facturadoTotal)

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Presupuestado</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(presupuestoTotal)}</p>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Facturado</p>
          <p className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">{formatCurrency(facturadoTotal)}</p>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Cobrado</p>
          <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">{formatCurrency(cobradoTotal)}</p>
        </div>
        <div className="border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Pendiente de facturar</p>
          <p className={`text-lg font-bold tabular-nums ${pendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {formatCurrency(pendiente)}
          </p>
        </div>
      </div>

      {/* Botón + Lista */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground text-sm">
          Facturas emitidas ({facturas.length})
        </h4>
        {puedeFacturar && pendiente > 0 && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Emitir factura proforma
          </Button>
        )}
      </div>

      {!puedeFacturar && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Para emitir facturas, el presupuesto debe estar en estado{' '}
            <strong>Aprobado</strong>, <strong>En Ejecución</strong> o <strong>Ejecutado</strong>.
            Actualmente: <strong>{presupuestoEstado}</strong>.
          </p>
        </div>
      )}

      {facturas.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
          Sin facturas emitidas desde este presupuesto
        </div>
      ) : (
        <div className="space-y-1.5">
          {facturas.map((f) => {
            const fechaFmt = typeof f.fecha === 'string' ? formatDate(f.fecha) : formatDate(f.fecha.toISOString())
            const saldo = Math.max(0, f.total - f.montoPagado)
            return (
              <Link
                key={f.id}
                href={`/contabilidad/facturas/${f.id}`}
                className="block border border-border rounded-lg px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className={`w-4 h-4 ${f.esProforma ? 'text-amber-500' : 'text-blue-500'} shrink-0`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-semibold text-sm text-foreground">{f.numero}</span>
                        {f.esProforma ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            PROFORMA
                          </span>
                        ) : f.ncf ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            {f.ncf}
                          </span>
                        ) : null}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ESTADO_COLOR[f.estado] || ''}`}>
                          {f.estado}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{fechaFmt}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(f.total)}</p>
                    {saldo > 0 ? (
                      <p className="text-[10px] text-amber-600">Saldo: {formatCurrency(saldo)}</p>
                    ) : f.estado !== 'anulada' ? (
                      <p className="text-[10px] text-green-600 flex items-center gap-0.5 justify-end">
                        <CheckCircle2 className="w-3 h-3" /> Cobrada
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showModal && (
        <EmitirFacturaModal
          presupuestoId={presupuestoId}
          pendiente={pendiente}
          presupuestoTotal={presupuestoTotal}
          onClose={() => setShowModal(false)}
          onSuccess={(id) => {
            setShowModal(false)
            router.refresh()
            router.push(`/contabilidad/facturas/${id}`)
          }}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Modal para emitir factura proforma
// ═══════════════════════════════════════════════════════════════════════

function EmitirFacturaModal({
  presupuestoId, pendiente, presupuestoTotal, onClose, onSuccess,
}: {
  presupuestoId: number
  pendiente: number
  presupuestoTotal: number
  onClose: () => void
  onSuccess: (facturaId: number) => void
}) {
  const [modo, setModo] = useState<'total' | 'porcentaje' | 'monto'>('total')
  const [porcentaje, setPorcentaje] = useState('30')
  const [monto, setMonto] = useState(pendiente.toFixed(2))
  const [descripcion, setDescripcion] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Monto efectivo según el modo
  const montoEfectivo =
    modo === 'total'
      ? pendiente
      : modo === 'porcentaje'
      ? +(presupuestoTotal * (parseFloat(porcentaje) || 0) / 100).toFixed(2)
      : parseFloat(monto) || 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (montoEfectivo <= 0) { setError('El monto debe ser mayor a 0'); return }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/emitir-factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: montoEfectivo,
          descripcion: descripcion.trim() || null,
          fechaVencimiento: fechaVencimiento || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al emitir')
      onSuccess(data.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Emitir factura proforma</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sin NCF. Puedes convertir a factura fiscal después registrando el NCF.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resumen */}
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total presupuesto:</span>
              <span className="font-semibold tabular-nums">{formatCurrency(presupuestoTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pendiente de facturar:</span>
              <span className="font-semibold tabular-nums text-amber-600">{formatCurrency(pendiente)}</span>
            </div>
          </div>

          {/* Selector de modo */}
          <div className="space-y-2">
            <Label className="text-xs">Monto a facturar</Label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setModo('total')}
                className={`py-2 text-xs rounded-lg border transition-colors ${
                  modo === 'total'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                Todo pendiente
              </button>
              <button
                type="button"
                onClick={() => setModo('porcentaje')}
                className={`py-2 text-xs rounded-lg border transition-colors ${
                  modo === 'porcentaje'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                % del total
              </button>
              <button
                type="button"
                onClick={() => setModo('monto')}
                className={`py-2 text-xs rounded-lg border transition-colors ${
                  modo === 'monto'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                Monto libre
              </button>
            </div>

            {modo === 'porcentaje' && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={porcentaje}
                  onChange={e => setPorcentaje(e.target.value)}
                  className="h-9 text-sm"
                />
                <span className="text-sm text-muted-foreground">% del total presupuesto</span>
              </div>
            )}

            {modo === 'monto' && (
              <Input
                type="number"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                className="h-9 text-sm"
              />
            )}
          </div>

          {/* Totales derivados */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Total a facturar:</span>
              <span className="tabular-nums">{formatCurrency(montoEfectivo)}</span>
            </div>
            {montoEfectivo > pendiente + 0.01 && (
              <p className="text-[11px] text-amber-600 mt-1">
                ⚠ El monto excede lo pendiente ({formatCurrency(pendiente)}). Asegúrate de que sea correcto.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Abono inicial 30%"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fecha de vencimiento (opcional)</Label>
            <Input
              type="date"
              value={fechaVencimiento}
              onChange={e => setFechaVencimiento(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting || montoEfectivo <= 0}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Emitir proforma
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
