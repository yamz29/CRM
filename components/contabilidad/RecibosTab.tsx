'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Receipt, CheckCircle2, Clock, Ban, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────

interface ClienteSimple { id: number; nombre: string }
interface CuentaSimple  { id: number; nombre: string }

interface Recibo {
  id: number
  numero: string
  clienteId: number
  fecha: string
  monto: number
  montoAplicado: number
  estado: 'sin_aplicar' | 'parcial' | 'aplicado' | 'anulado'
  metodoPago: string
  referencia: string | null
  observaciones: string | null
  cliente: { id: number; nombre: string }
  cuentaBancaria: { id: number; nombre: string } | null
  _count: { aplicaciones: number }
}

interface FacturaPendiente {
  id: number
  numero: string
  fecha: string
  total: number
  montoPagado: number
  descripcion: string | null
}

interface Props {
  clientes: ClienteSimple[]
  cuentas: CuentaSimple[]
}

// ── Badge config ─────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { color: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  sin_aplicar: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', label: 'Sin aplicar', icon: Clock },
  parcial:     { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',    label: 'Parcial',     icon: Clock },
  aplicado:    { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Aplicado',   icon: CheckCircle2 },
  anulado:     { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',         label: 'Anulado',    icon: Ban },
}

const METODOS_PAGO = ['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta'] as const

// ── Main component ───────────────────────────────────────────────────────

export function RecibosTab({ clientes, cuentas }: Props) {
  const toast = useToast()

  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Confirm dialog state
  const [confirm, setConfirm] = useState<{
    titulo: string
    descripcion?: string
    onConfirmar: () => void
  } | null>(null)

  // ── Fetch recibos ──
  const fetchRecibos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cobros/recibos')
      if (res.ok) {
        const data = await res.json()
        setRecibos(data)
      } else {
        toast.error('Error al cargar recibos')
      }
    } catch {
      toast.error('Error de red al cargar recibos')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchRecibos() }, [fetchRecibos])

  // ── Anular recibo ──
  const handleAnular = (recibo: Recibo) => {
    setConfirm({
      titulo: `¿Anular recibo ${recibo.numero}?`,
      descripcion: 'Se anularán también todas las aplicaciones de este recibo.',
      onConfirmar: async () => {
        setConfirm(null)
        const res = await fetch(`/api/cobros/recibos/${recibo.id}/anular`, { method: 'POST' })
        if (res.ok) {
          toast.exito(`Recibo ${recibo.numero} anulado`)
          fetchRecibos()
        } else {
          const data = await res.json().catch(() => null)
          toast.error(data?.error ?? 'No se pudo anular el recibo')
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Recibos de cobro y su aplicación contra facturas pendientes.
        </p>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> Nuevo recibo
        </Button>
      </div>

      {/* Form panel */}
      {showForm && (
        <ReciboFormPanel
          clientes={clientes}
          cuentas={cuentas}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchRecibos() }}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['sin_aplicar', 'parcial', 'aplicado', 'anulado'] as const).map(estado => {
          const cfg = ESTADO_CONFIG[estado]
          const Icon = cfg.icon
          const count = recibos.filter(r => r.estado === estado).length
          const total = recibos.filter(r => r.estado === estado).reduce((s, r) => s + r.monto, 0)
          return (
            <div key={estado} className="bg-card border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Icon className="w-3 h-3" /> {cfg.label}
              </p>
              <p className="text-xl font-bold mt-0.5">{count}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(total)}</p>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando recibos...
          </div>
        ) : recibos.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">No hay recibos registrados. Crea el primero con &quot;Nuevo recibo&quot;.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Número</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase text-right">Monto</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase text-right">Aplicado</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase text-right">Saldo c/c</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Cuenta</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recibos.map(r => {
                  const cfg = ESTADO_CONFIG[r.estado] ?? ESTADO_CONFIG.sin_aplicar
                  const Icon = cfg.icon
                  const saldo = r.monto - r.montoAplicado
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold font-mono text-foreground">{r.numero}</span>
                        <p className="text-[10px] text-muted-foreground">{r.metodoPago}</p>
                        {r.referencia && <p className="text-[10px] text-muted-foreground font-mono">{r.referencia}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.fecha)}</td>
                      <td className="px-4 py-3 text-foreground">{r.cliente.nombre}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{formatCurrency(r.monto)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(r.montoAplicado)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={saldo > 0.01 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}>
                          {formatCurrency(saldo)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.cuentaBancaria?.nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        {r.estado !== 'anulado' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAnular(r)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Ban className="w-3.5 h-3.5" /> Anular
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        abierto={confirm !== null}
        titulo={confirm?.titulo ?? ''}
        descripcion={confirm?.descripcion}
        textoConfirmar="Sí, anular"
        variante="peligro"
        onConfirmar={() => confirm?.onConfirmar()}
        onCancelar={() => setConfirm(null)}
      />
    </div>
  )
}

// ── Recibo Form Panel ────────────────────────────────────────────────────

interface FormPanelProps {
  clientes: ClienteSimple[]
  cuentas: CuentaSimple[]
  onClose: () => void
  onSaved: () => void
}

function ReciboFormPanel({ clientes, cuentas, onClose, onSaved }: FormPanelProps) {
  const toast = useToast()

  // Form fields
  const today = new Date().toISOString().slice(0, 10)
  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(today)
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState<string>('Transferencia')
  const [cuentaBancariaId, setCuentaBancariaId] = useState('')
  const [referencia, setReferencia] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Application section
  const [facturasPendientes, setFacturasPendientes] = useState<FacturaPendiente[]>([])
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [aplicaciones, setAplicaciones] = useState<Record<number, string>>({}) // facturaId → monto string

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Load pending invoices when client changes
  useEffect(() => {
    if (!clienteId) {
      setFacturasPendientes([])
      setAplicaciones({})
      return
    }
    setLoadingFacturas(true)
    fetch(`/api/contabilidad/facturas?tipo=ingreso&clienteId=${clienteId}`)
      .then(r => r.ok ? r.json() : { facturas: [] })
      .then(data => {
        const all: FacturaPendiente[] = (data.facturas ?? [])
          .filter((f: any) => f.estado !== 'pagada' && f.estado !== 'anulada')
          .map((f: any) => ({
            id: f.id,
            numero: f.numero,
            fecha: f.fecha,
            total: f.total,
            montoPagado: f.montoPagado,
            descripcion: f.descripcion,
          }))
        setFacturasPendientes(all)
        setAplicaciones({})
      })
      .catch(() => setFacturasPendientes([]))
      .finally(() => setLoadingFacturas(false))
  }, [clienteId])

  // Derived validation
  const montoNum = parseFloat(monto) || 0
  const totalAplicado = facturasPendientes.reduce((sum, f) => {
    return sum + (parseFloat(aplicaciones[f.id] ?? '') || 0)
  }, 0)
  const sumExceedsMonto = totalAplicado > montoNum + 0.001
  const exceededFacturas = facturasPendientes.filter(f => {
    const ap = parseFloat(aplicaciones[f.id] ?? '') || 0
    const saldo = f.total - f.montoPagado
    return ap > saldo + 0.001
  })

  const isValid = !sumExceedsMonto && exceededFacturas.length === 0

  const handleAplicacionChange = (facturaId: number, value: string) => {
    setAplicaciones(prev => ({ ...prev, [facturaId]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!clienteId) { setFormError('Selecciona un cliente'); return }
    if (!monto || montoNum <= 0) { setFormError('El monto debe ser mayor a 0'); return }
    if (!isValid) { setFormError('Revisa los montos de aplicación antes de continuar'); return }

    const aplicacionesPayload = facturasPendientes
      .map(f => ({ facturaId: f.id, monto: parseFloat(aplicaciones[f.id] ?? '') || 0 }))
      .filter(a => a.monto > 0)

    const payload = {
      clienteId: parseInt(clienteId),
      fecha,
      monto: montoNum,
      metodoPago,
      cuentaBancariaId: cuentaBancariaId ? parseInt(cuentaBancariaId) : undefined,
      referencia: referencia.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      aplicaciones: aplicacionesPayload.length > 0 ? aplicacionesPayload : undefined,
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/cobros/recibos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.exito('Recibo creado correctamente')
        onSaved()
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

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'text-xs font-medium text-muted-foreground'

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4 text-muted-foreground" /> Nuevo recibo de cobro
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Main fields grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={labelCls}>Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls} required>
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>Monto recibido *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              className={inputCls}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className={labelCls}>Método de pago</label>
            <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className={inputCls}>
              {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Cuenta bancaria</label>
            <select value={cuentaBancariaId} onChange={e => setCuentaBancariaId(e.target.value)} className={inputCls}>
              <option value="">— Ninguna —</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Referencia</label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              className={inputCls}
              placeholder="Nro. transferencia, cheque…"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls}>Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className={inputCls}
              placeholder="Nota interna opcional"
            />
          </div>
        </div>

        {/* Application section */}
        {clienteId && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">
              Aplicar contra facturas pendientes
              <span className="ml-2 text-xs font-normal text-muted-foreground">(opcional)</span>
            </h4>

            {loadingFacturas && (
              <p className="text-xs text-muted-foreground">Cargando facturas...</p>
            )}

            {!loadingFacturas && facturasPendientes.length === 0 && (
              <p className="text-xs text-muted-foreground">Este cliente no tiene facturas pendientes.</p>
            )}

            {!loadingFacturas && facturasPendientes.length > 0 && (
              <>
                <div className="space-y-2">
                  {facturasPendientes.map(f => {
                    const saldo = f.total - f.montoPagado
                    const ap = parseFloat(aplicaciones[f.id] ?? '') || 0
                    const exceedsFactura = ap > saldo + 0.001
                    return (
                      <div key={f.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                        <div className="col-span-7">
                          <span className="font-mono font-semibold text-foreground">{f.numero}</span>
                          <span className="ml-2 text-muted-foreground">{formatDate(f.fecha)}</span>
                          {f.descripcion && <p className="text-xs text-muted-foreground truncate">{f.descripcion}</p>}
                          <p className="text-xs text-muted-foreground">
                            Total: {formatCurrency(f.total)} · Saldo: <span className="text-amber-600 dark:text-amber-400">{formatCurrency(saldo)}</span>
                          </p>
                        </div>
                        <div className="col-span-5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={saldo}
                            value={aplicaciones[f.id] ?? ''}
                            onChange={e => handleAplicacionChange(f.id, e.target.value)}
                            className={`w-full border rounded-md px-2 py-1 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring ${exceedsFactura ? 'border-red-500' : 'border-border'}`}
                            placeholder="0.00"
                          />
                          {exceedsFactura && (
                            <p className="text-[10px] text-red-600 mt-0.5">Supera el saldo ({formatCurrency(saldo)})</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Application summary */}
                <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
                  <span className="text-muted-foreground">Total a aplicar:</span>
                  <span className={`font-bold tabular-nums ${sumExceedsMonto ? 'text-red-600' : 'text-foreground'}`}>
                    {formatCurrency(totalAplicado)}
                    {montoNum > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">/ {formatCurrency(montoNum)}</span>}
                  </span>
                </div>

                {sumExceedsMonto && (
                  <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    La suma de aplicaciones ({formatCurrency(totalAplicado)}) supera el monto del recibo ({formatCurrency(montoNum)}).
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Form error */}
        {formError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !isValid}>
            {submitting ? 'Guardando...' : 'Crear recibo'}
          </Button>
        </div>
      </form>
    </div>
  )
}
