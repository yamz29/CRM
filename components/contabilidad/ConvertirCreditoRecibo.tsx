'use client'

import { useState, useEffect } from 'react'
import { X, Receipt, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { AplicarFacturasFields, type FacturaPendiente } from '@/components/contabilidad/RecibosTab'

// ── Types ─────────────────────────────────────────────────────────────────

interface ClienteSimple {
  id: number
  nombre: string
}

interface MovimientoSimple {
  id: number
  monto: number
  fecha: string
  descripcion: string
  referencia?: string | null
}

interface Props {
  movimiento: MovimientoSimple
  clientes: ClienteSimple[]
  onClose: () => void
  onDone: () => void
}

// ── Component ─────────────────────────────────────────────────────────────

export function ConvertirCreditoRecibo({ movimiento, clientes, onClose, onDone }: Props) {
  const toast = useToast()

  const [clienteId, setClienteId] = useState('')
  const [facturas, setFacturas] = useState<FacturaPendiente[]>([])
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [aplicaciones, setAplicaciones] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Load pending invoices when client changes
  useEffect(() => {
    if (!clienteId) {
      setFacturas([])
      setAplicaciones({})
      return
    }
    setLoadingFacturas(true)
    fetch(`/api/contabilidad/facturas?tipo=ingreso&clienteId=${clienteId}`)
      .then(r => r.ok ? r.json() : { facturas: [] })
      .then(data => {
        const all: FacturaPendiente[] = (data.facturas ?? [])
          .filter((f: { estado: string }) => f.estado !== 'pagada' && f.estado !== 'anulada')
          .map((f: {
            id: number
            numero: string
            fecha: string
            total: number
            montoPagado: number
            descripcion: string | null
          }) => ({
            id: f.id,
            numero: f.numero,
            fecha: f.fecha,
            total: f.total,
            montoPagado: f.montoPagado,
            descripcion: f.descripcion,
          }))
        setFacturas(all)
        setAplicaciones({})
      })
      .catch(() => setFacturas([]))
      .finally(() => setLoadingFacturas(false))
  }, [clienteId])

  // Validation
  const totalAplicado = facturas.reduce((sum, f) => sum + (parseFloat(aplicaciones[f.id] ?? '') || 0), 0)
  const sumExceedsMonto = totalAplicado > movimiento.monto + 0.001
  const exceededFacturas = facturas.filter(f => {
    const ap = parseFloat(aplicaciones[f.id] ?? '') || 0
    const saldo = f.total - f.montoPagado
    return ap > saldo + 0.001
  })
  const hasValidationError = sumExceedsMonto || exceededFacturas.length > 0

  const handleConfirm = async () => {
    if (!clienteId) return

    const aplicacionesPayload = facturas
      .map(f => ({ facturaId: f.id, monto: parseFloat(aplicaciones[f.id] ?? '') || 0 }))
      .filter(a => a.monto > 0)

    setSubmitting(true)
    try {
      const res = await fetch('/api/cobros/recibos/desde-movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movimientoId: movimiento.id,
          clienteId: parseInt(clienteId),
          aplicaciones: aplicacionesPayload.length > 0 ? aplicacionesPayload : undefined,
        }),
      })
      if (res.ok) {
        toast.exito('Recibo creado y movimiento conciliado correctamente')
        onDone()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Error al crear el recibo')
      }
    } catch {
      toast.error('Error de red al crear el recibo')
    } finally {
      setSubmitting(false)
    }
  }

  const canConfirm = !!clienteId && !hasValidationError && !submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted-foreground" /> Convertir crédito en recibo
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" disabled={submitting}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Movement summary */}
        <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Movimiento bancario</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="font-medium text-foreground">{formatDate(movimiento.fecha)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="font-bold tabular-nums text-green-600 dark:text-green-400">{formatCurrency(movimiento.monto)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="font-mono text-xs text-foreground">{movimiento.referencia || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Descripción</p>
            <p className="text-foreground truncate">{movimiento.descripcion}</p>
          </div>
        </div>

        {/* Client selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Pending invoices */}
        {clienteId && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Aplicar contra facturas pendientes
              <span className="ml-2 text-xs font-normal text-muted-foreground">(opcional — dejar en blanco = anticipo)</span>
            </h4>

            {loadingFacturas && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Cargando facturas...
              </p>
            )}

            {!loadingFacturas && facturas.length === 0 && (
              <p className="text-xs text-muted-foreground">Este cliente no tiene facturas pendientes.</p>
            )}

            {!loadingFacturas && facturas.length > 0 && (
              <AplicarFacturasFields
                facturas={facturas}
                valores={aplicaciones}
                onChange={(id, val) => setAplicaciones(prev => ({ ...prev, [id]: val }))}
                max={movimiento.monto}
              />
            )}
          </div>
        )}

        {/* Validation error hint */}
        {hasValidationError && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {sumExceedsMonto
              ? `La suma de aplicaciones supera el monto del crédito (${formatCurrency(movimiento.monto)})`
              : 'Un monto de aplicación supera el saldo de su factura'}
          </div>
        )}

        {/* Info: what will happen */}
        {clienteId && !hasValidationError && (
          <p className="text-xs text-muted-foreground">
            Se creará un recibo de <span className="font-semibold text-foreground">{formatCurrency(movimiento.monto)}</span> con método
            &ldquo;Transferencia&rdquo; y el movimiento quedará marcado como conciliado.
            {totalAplicado <= 0.001
              ? ' Será un anticipo (sin aplicar a facturas).'
              : ` Se aplicarán ${formatCurrency(totalAplicado)} a facturas.`}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {submitting ? 'Creando recibo...' : 'Crear recibo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
