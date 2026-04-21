'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowUpCircle, ArrowDownCircle, Plus, FileText,
  CheckCircle2, Clock, XCircle, ArrowRightLeft, CreditCard,
  ExternalLink, Trash2, Ban, Pencil, FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface Cuenta { id: number; nombre: string; banco: string }
interface Pago {
  id: number; fecha: string; monto: number; metodoPago: string
  referencia: string | null; observaciones: string | null
  cuentaBancaria: Cuenta | null
}
interface Factura {
  id: number; numero: string; ncf: string | null; tipo: string
  fecha: string; fechaVencimiento: string | null
  proveedor: string | null; rncProveedor: string | null
  clienteId: number | null; cliente: { id: number; nombre: string } | null
  destinoTipo: string; proyectoId: number | null
  proyecto: { id: number; nombre: string } | null
  descripcion: string | null
  subtotal: number
  tasaItbis?: number
  impuesto: number
  propinaLegal?: number
  otrosImpuestos?: number
  total: number; montoPagado: number; estado: string
  archivoUrl: string | null; driveUrl: string | null
  observaciones: string | null
  pagos: Pago[]
}

const ESTADOS_BADGE: Record<string, { color: string; icon: any; label: string }> = {
  pendiente: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pendiente' },
  parcial: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: ArrowRightLeft, label: 'Parcial' },
  pagada: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Pagada' },
  anulada: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Anulada' },
}

function fileUrl(archivoUrl: string | null) {
  if (!archivoUrl) return ''
  // Serve via API route to handle dynamic uploads in production
  return archivoUrl.startsWith('/uploads/') ? `/api${archivoUrl}` : archivoUrl
}

export function FacturaDetalle({ factura: initialFactura, cuentas }: { factura: Factura; cuentas: Cuenta[] }) {
  const router = useRouter()
  const [factura, setFactura] = useState(initialFactura)
  const [showPagoForm, setShowPagoForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const saldoPendiente = factura.total - factura.montoPagado
  const badge = ESTADOS_BADGE[factura.estado] || ESTADOS_BADGE.pendiente
  const BadgeIcon = badge.icon

  const handleAnular = async () => {
    if (!confirm('¿Anular esta factura? No se podrán registrar más pagos.')) return
    const res = await fetch(`/api/contabilidad/facturas/${factura.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'anulada' }),
    })
    if (res.ok) router.refresh()
  }

  const handleDeletePago = async (pagoId: number) => {
    if (!confirm('¿Eliminar este pago? Se recalculará el saldo de la factura.')) return
    const res = await fetch(`/api/contabilidad/facturas/${factura.id}/pagos/${pagoId}`, { method: 'DELETE' })
    if (res.ok) refreshFactura()
    else alert('Error al eliminar pago')
  }

  const refreshFactura = async () => {
    const res = await fetch(`/api/contabilidad/facturas/${factura.id}`)
    if (res.ok) setFactura(await res.json())
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/contabilidad" className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/40">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Factura #{factura.numero}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                <BadgeIcon className="w-3 h-3" /> {badge.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {factura.tipo === 'ingreso' ? 'Factura de ingreso' : 'Factura de egreso'}
              {factura.ncf && <span className="ml-2 font-mono">NCF: {factura.ncf}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/contabilidad/facturas/${factura.id}/editar`}>
            <Button variant="outline"><Pencil className="w-4 h-4" /> Editar</Button>
          </Link>
          {factura.estado !== 'anulada' && factura.estado !== 'pagada' && (
            <Button variant="outline" onClick={handleAnular}>
              <Ban className="w-4 h-4" /> Anular
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Invoice details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="flex items-center gap-1 font-medium">
                  {factura.tipo === 'ingreso'
                    ? <><ArrowUpCircle className="w-4 h-4 text-green-500" /> Ingreso</>
                    : <><ArrowDownCircle className="w-4 h-4 text-red-500" /> Egreso</>
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="font-medium">{new Date(factura.fecha).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{factura.tipo === 'ingreso' ? 'Cliente' : 'Proveedor'}</p>
                <p className="font-medium">
                  {factura.tipo === 'ingreso' ? (factura.cliente?.nombre || 'Sin cliente') : (factura.proveedor || 'Sin proveedor')}
                </p>
              </div>
              {factura.rncProveedor && (
                <div>
                  <p className="text-xs text-muted-foreground">RNC Proveedor</p>
                  <p className="font-medium font-mono">{factura.rncProveedor}</p>
                </div>
              )}
              {factura.fechaVencimiento && (
                <div>
                  <p className="text-xs text-muted-foreground">Vencimiento</p>
                  <p className="font-medium">{new Date(factura.fechaVencimiento).toLocaleDateString('es-DO')}</p>
                </div>
              )}
              {(factura.destinoTipo !== 'general' || factura.proyecto) && (
                <div>
                  <p className="text-xs text-muted-foreground">Asignado a</p>
                  <p className="flex items-center gap-1 font-medium">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    {factura.proyecto ? (
                      <Link href={`/proyectos/${factura.proyecto.id}`} className="text-primary hover:underline">{factura.proyecto.nombre}</Link>
                    ) : (
                      <span className="capitalize">{factura.destinoTipo}</span>
                    )}
                  </p>
                </div>
              )}
            </div>
            {factura.descripcion && (
              <div>
                <p className="text-xs text-muted-foreground">Descripción</p>
                <p className="text-sm">{factura.descripcion}</p>
              </div>
            )}
            {factura.observaciones && (
              <div>
                <p className="text-xs text-muted-foreground">Observaciones</p>
                <p className="text-sm text-muted-foreground">{factura.observaciones}</p>
              </div>
            )}
          </div>

          {/* Pagos section */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Pagos registrados ({factura.pagos.length})
              </h3>
              {factura.estado !== 'anulada' && factura.estado !== 'pagada' && (
                <Button size="sm" onClick={() => setShowPagoForm(!showPagoForm)}>
                  <Plus className="w-3.5 h-3.5" /> Registrar Pago
                </Button>
              )}
            </div>

            {showPagoForm && (
              <PagoForm
                facturaId={factura.id}
                saldoPendiente={saldoPendiente}
                cuentas={cuentas}
                onClose={() => setShowPagoForm(false)}
                onSaved={() => { setShowPagoForm(false); refreshFactura() }}
              />
            )}

            {factura.pagos.length > 0 ? (
              <div className="space-y-2">
                {factura.pagos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(p.monto)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.fecha).toLocaleDateString('es-DO')} — {p.metodoPago}
                        {p.referencia && <span className="ml-1 font-mono">({p.referencia})</span>}
                        {p.cuentaBancaria && <span className="ml-1">— {p.cuentaBancaria.nombre}</span>}
                      </p>
                      {p.observaciones && <p className="text-xs text-muted-foreground mt-0.5">{p.observaciones}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <button onClick={() => handleDeletePago(p.id)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Eliminar pago">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No hay pagos registrados</p>
            )}
          </div>
        </div>

        {/* Right Column: Amounts + File */}
        <div className="space-y-6">
          {/* Amounts */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(factura.subtotal)}</span>
            </div>
            {factura.impuesto > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  ITBIS {factura.tasaItbis != null ? `${factura.tasaItbis}%` : ''}
                </span>
                <span className="tabular-nums">{formatCurrency(factura.impuesto)}</span>
              </div>
            )}
            {factura.propinaLegal != null && factura.propinaLegal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Propina Legal 10% <span className="text-[10px]">(Ley 228)</span></span>
                <span className="tabular-nums">{formatCurrency(factura.propinaLegal)}</span>
              </div>
            )}
            {factura.otrosImpuestos != null && factura.otrosImpuestos > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Otros impuestos</span>
                <span className="tabular-nums">{formatCurrency(factura.otrosImpuestos)}</span>
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums text-lg">{formatCurrency(factura.total)}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Pagado</span>
              <span className="tabular-nums text-green-600">{formatCurrency(factura.montoPagado)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">Saldo pendiente</span>
              <span className={`tabular-nums ${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(saldoPendiente)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="pt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((factura.montoPagado / factura.total) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {factura.total > 0 ? Math.round((factura.montoPagado / factura.total) * 100) : 0}% pagado
              </p>
            </div>
          </div>

          {/* File */}
          {(factura.archivoUrl || factura.driveUrl) && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4" /> Documento adjunto
              </h3>
              {factura.archivoUrl?.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <a href={fileUrl(factura.archivoUrl)} target="_blank" rel="noopener noreferrer">
                  <img src={fileUrl(factura.archivoUrl)} alt="Factura" className="rounded-lg border border-border max-h-64 w-full object-contain" />
                </a>
              ) : factura.archivoUrl ? (
                <a href={fileUrl(factura.archivoUrl)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="text-sm text-primary">Ver documento</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                </a>
              ) : null}
              {factura.driveUrl && (
                <a href={factura.driveUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.4z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Ver en Google Drive</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-auto text-blue-500" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pago Form ────────────────────────────────────────────────────────────

function PagoForm({ facturaId, saldoPendiente, cuentas, onClose, onSaved }: {
  facturaId: number; saldoPendiente: number; cuentas: Cuenta[]; onClose: () => void; onSaved: () => void
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState(saldoPendiente.toFixed(2))
  const [metodoPago, setMetodoPago] = useState('Transferencia')
  const [referencia, setReferencia] = useState('')
  const [cuentaBancariaId, setCuentaBancariaId] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')

    const res = await fetch(`/api/contabilidad/facturas/${facturaId}/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha, monto: parseFloat(monto), metodoPago, referencia: referencia || null,
        cuentaBancariaId: cuentaBancariaId ? parseInt(cuentaBancariaId) : null,
        observaciones: observaciones || null,
      }),
    })

    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json()
      setError(d.error || 'Error al registrar pago')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
      <h4 className="font-medium text-sm mb-3">Registrar Pago</h4>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Monto (pend: {formatCurrency(saldoPendiente)})</label>
          <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Método</label>
          <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={inputCls}>
            <option value="Transferencia">Transferencia</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Cheque">Cheque</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Referencia</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} placeholder="Nro. cheque, ref. transferencia" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cuenta bancaria</label>
          <select value={cuentaBancariaId} onChange={(e) => setCuentaBancariaId(e.target.value)} className={inputCls}>
            <option value="">Sin cuenta</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Observaciones</label>
          <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2 flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Registrar Pago'}</Button>
        </div>
      </form>
    </div>
  )
}
