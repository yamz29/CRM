'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, X, Receipt, CheckCircle2, Clock, Ban, AlertCircle, RefreshCw, CreditCard, Printer, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────

interface ClienteSimple { id: number; nombre: string }
interface CuentaSimple  { id: number; nombre: string }

import type { ReciboLista as Recibo } from '@/lib/types'

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

// ── AplicarFacturasFields (shared sub-component) ─────────────────────────

export interface AplicarFacturasFieldsProps {
  facturas: FacturaPendiente[]
  valores: Record<number, string>
  onChange: (facturaId: number, val: string) => void
  /** disponible: max total that can be applied (recibo monto or saldo) */
  max: number
}

export type { FacturaPendiente }

export function AplicarFacturasFields({ facturas, valores, onChange, max }: AplicarFacturasFieldsProps) {
  const totalAplicado = facturas.reduce((sum, f) => sum + (parseFloat(valores[f.id] ?? '') || 0), 0)
  const sumExceedsMax = totalAplicado > max + 0.001

  return (
    <>
      <div className="space-y-2">
        {facturas.map(f => {
          const saldo = f.total - f.montoPagado
          const ap = parseFloat(valores[f.id] ?? '') || 0
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
                  value={valores[f.id] ?? ''}
                  onChange={e => onChange(f.id, e.target.value)}
                  className={`w-full border rounded-md px-2 py-1 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring ${exceedsFactura ? 'border-red-500' : 'border-border'}`}
                  placeholder="0.00"
                />
                {exceedsFactura && (
                  <p className="text-2xs text-red-600 mt-0.5">Supera el saldo ({formatCurrency(saldo)})</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Application summary */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
        <span className="text-muted-foreground">Total a aplicar:</span>
        <span className={`font-bold tabular-nums ${sumExceedsMax ? 'text-red-600' : 'text-foreground'}`}>
          {formatCurrency(totalAplicado)}
          {max > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">/ {formatCurrency(max)}</span>}
        </span>
      </div>

      {sumExceedsMax && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          La suma de aplicaciones ({formatCurrency(totalAplicado)}) supera el disponible ({formatCurrency(max)}).
        </div>
      )}
    </>
  )
}

// ── AplicarModal ──────────────────────────────────────────────────────────

interface AplicarModalProps {
  recibo: Recibo
  onClose: () => void
  onDone: () => void
}

function AplicarModal({ recibo, onClose, onDone }: AplicarModalProps) {
  const toast = useToast()
  const disponible = recibo.monto - recibo.montoAplicado

  const [facturas, setFacturas] = useState<FacturaPendiente[]>([])
  const [loadingFacturas, setLoadingFacturas] = useState(true)
  const [aplicaciones, setAplicaciones] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Aplicaciones ya existentes del recibo (para poder quitarlas).
  type AplicacionActual = { id: number; facturaId: number; monto: number; factura: { id: number; numero: string } }
  const [actuales, setActuales] = useState<AplicacionActual[]>([])
  const [confirmQuitar, setConfirmQuitar] = useState<AplicacionActual | null>(null)

  const cargarActuales = useCallback(() => {
    fetch(`/api/cobros/recibos/${recibo.id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => setActuales(data?.aplicaciones ?? []))
      .catch(() => setActuales([]))
  }, [recibo.id])

  useEffect(() => { cargarActuales() }, [cargarActuales])

  // Fetch client's pending invoices on mount
  useEffect(() => {
    setLoadingFacturas(true)
    fetch(`/api/contabilidad/facturas?tipo=ingreso&clienteId=${recibo.clienteId}`)
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
        setFacturas(all)
        setAplicaciones({})
      })
      .catch(() => setFacturas([]))
      .finally(() => setLoadingFacturas(false))
  }, [recibo.clienteId])

  // Client-side validation
  const totalAplicado = facturas.reduce((sum, f) => sum + (parseFloat(aplicaciones[f.id] ?? '') || 0), 0)
  const sumExceedsDisponible = totalAplicado > disponible + 0.001
  const exceededFacturas = facturas.filter(f => {
    const ap = parseFloat(aplicaciones[f.id] ?? '') || 0
    const saldo = f.total - f.montoPagado
    return ap > saldo + 0.001
  })
  const hasPositive = totalAplicado > 0.001
  const isValid = !sumExceedsDisponible && exceededFacturas.length === 0 && hasPositive

  const handleAplicar = async () => {
    const aplicacionesPayload = facturas
      .map(f => ({ facturaId: f.id, monto: parseFloat(aplicaciones[f.id] ?? '') || 0 }))
      .filter(a => a.monto > 0)

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cobros/recibos/${recibo.id}/aplicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aplicaciones: aplicacionesPayload }),
      })
      if (res.ok) {
        toast.exito(`Aplicaciones registradas en recibo ${recibo.numero}`)
        onDone()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Error al aplicar el recibo')
      }
    } catch {
      toast.error('Error de red al aplicar el recibo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuitar = async (apl: AplicacionActual) => {
    setConfirmQuitar(null)
    try {
      const res = await fetch(`/api/cobros/recibos/${recibo.id}/aplicaciones/${apl.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.exito(`Aplicación a ${apl.factura.numero} quitada`)
        cargarActuales()
        onDone()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo quitar la aplicación')
      }
    } catch {
      toast.error('Error de red al quitar la aplicación')
    }
  }

  // Determine why confirm is disabled
  let disabledReason = ''
  if (!hasPositive) disabledReason = 'Ingresa al menos un monto a aplicar'
  else if (sumExceedsDisponible) disabledReason = `La suma supera el disponible (${formatCurrency(disponible)})`
  else if (exceededFacturas.length > 0) disabledReason = 'Un monto supera el saldo de su factura'

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" /> Aplicar recibo {recibo.numero}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recibo summary */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium text-foreground">{recibo.cliente.nombre}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monto recibo</p>
            <p className="font-bold tabular-nums">{formatCurrency(recibo.monto)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disponible</p>
            <p className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(disponible)}</p>
          </div>
        </div>

        {/* Aplicaciones actuales del recibo */}
        {actuales.length > 0 && (
          <div className="border border-border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Aplicado actualmente</h4>
            {actuales.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {a.factura.numero} — <span className="tabular-nums">{formatCurrency(a.monto)}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-red-600"
                  onClick={() => setConfirmQuitar(a)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Quitar
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pending invoices */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            Facturas pendientes del cliente
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
              max={disponible}
            />
          )}
        </div>

        {/* Disabled reason hint */}
        {disabledReason && !loadingFacturas && facturas.length > 0 && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {disabledReason}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleAplicar}
            disabled={submitting || !isValid || loadingFacturas}
          >
            {submitting ? 'Aplicando...' : 'Confirmar aplicación'}
          </Button>
        </div>

        <ConfirmDialog
          abierto={confirmQuitar !== null}
          titulo="¿Quitar esta aplicación?"
          descripcion={confirmQuitar
            ? `Se desaplicará ${formatCurrency(confirmQuitar.monto)} de la factura ${confirmQuitar.factura.numero}. El monto del recibo no se modifica.`
            : ''}
          textoConfirmar="Sí, quitar"
          variante="peligro"
          onConfirmar={() => { if (confirmQuitar) handleQuitar(confirmQuitar) }}
          onCancelar={() => setConfirmQuitar(null)}
        />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────

export function RecibosTab({ clientes, cuentas }: Props) {
  const toast = useToast()

  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Confirm dialog state (for Anular)
  const [confirm, setConfirm] = useState<{
    titulo: string
    descripcion?: string
    onConfirmar: () => void
  } | null>(null)

  // Apply modal state
  const [reciboAplicar, setReciboAplicar] = useState<Recibo | null>(null)

  // ── Filtros (client-side sobre la lista cargada) ──
  const [fEstado, setFEstado] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fBusqueda, setFBusqueda] = useState('')
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const hayFiltros = !!(fEstado || fCliente || fBusqueda || fDesde || fHasta)
  const limpiarFiltros = () => { setFEstado(''); setFCliente(''); setFBusqueda(''); setFDesde(''); setFHasta('') }

  const recibosFiltrados = useMemo(() => {
    const q = fBusqueda.trim().toLowerCase()
    const desde = fDesde ? new Date(fDesde + 'T00:00:00') : null
    const hasta = fHasta ? new Date(fHasta + 'T23:59:59') : null
    return recibos.filter(r => {
      if (fEstado && r.estado !== fEstado) return false
      if (fCliente && r.clienteId !== Number(fCliente)) return false
      if (desde || hasta) {
        const f = new Date(r.fecha)
        if (desde && f < desde) return false
        if (hasta && f > hasta) return false
      }
      if (q) {
        const hay = r.numero.toLowerCase().includes(q)
          || (r.referencia?.toLowerCase().includes(q) ?? false)
          || r.cliente.nombre.toLowerCase().includes(q)
        if (!hay) return false
      }
      return true
    })
  }, [recibos, fEstado, fCliente, fBusqueda, fDesde, fHasta])

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

      {/* Barra de filtros */}
      {recibos.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text" value={fBusqueda} onChange={e => setFBusqueda(e.target.value)}
              placeholder="N° recibo, referencia o cliente"
              className="h-8 w-64 text-xs border border-border rounded-lg pl-7 pr-2 bg-input text-foreground"
            />
          </div>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)}
            className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
            <option value="">Todos los estados</option>
            {(['sin_aplicar', 'parcial', 'aplicado', 'anulado'] as const).map(es => (
              <option key={es} value={es}>{ESTADO_CONFIG[es].label}</option>
            ))}
          </select>
          <select value={fCliente} onChange={e => setFCliente(e.target.value)}
            className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
            <option value="">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
          </select>
          <input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)}
            className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground" />
          <span className="text-xs text-muted-foreground">a</span>
          <input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)}
            className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground" />
          {hayFiltros && (
            <button onClick={limpiarFiltros}
              className="h-8 px-2.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{recibosFiltrados.length} de {recibos.length}</span>
        </div>
      )}

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
        ) : recibosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Search className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Ningún recibo coincide con los filtros.</p>
            <button onClick={limpiarFiltros} className="text-xs text-primary hover:underline mt-1">Limpiar filtros</button>
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
                {recibosFiltrados.map(r => {
                  const cfg = ESTADO_CONFIG[r.estado] ?? ESTADO_CONFIG.sin_aplicar
                  const Icon = cfg.icon
                  const saldo = r.monto - r.montoAplicado
                  const puedeAplicar = saldo > 0.01 && r.estado !== 'anulado'
                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold font-mono text-foreground">{r.numero}</span>
                        <p className="text-2xs text-muted-foreground">{r.metodoPago}</p>
                        {r.referencia && <p className="text-2xs text-muted-foreground font-mono">{r.referencia}</p>}
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
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.cuentaBancaria?.nombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {puedeAplicar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReciboAplicar(r)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Aplicar
                            </Button>
                          )}
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
                          <a
                            href={`/cobros/recibos/${r.id}/imprimir`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" /> Imprimir
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm dialog (Anular) */}
      <ConfirmDialog
        abierto={confirm !== null}
        titulo={confirm?.titulo ?? ''}
        descripcion={confirm?.descripcion}
        textoConfirmar="Sí, anular"
        variante="peligro"
        onConfirmar={() => confirm?.onConfirmar()}
        onCancelar={() => setConfirm(null)}
      />

      {/* Apply modal */}
      {reciboAplicar && (
        <AplicarModal
          recibo={reciboAplicar}
          onClose={() => setReciboAplicar(null)}
          onDone={() => { setReciboAplicar(null); fetchRecibos() }}
        />
      )}
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
              <AplicarFacturasFields
                facturas={facturasPendientes}
                valores={aplicaciones}
                onChange={(id, val) => setAplicaciones(prev => ({ ...prev, [id]: val }))}
                max={montoNum}
              />
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
