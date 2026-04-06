'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Landmark, FileText, Plus, Search, Filter, ArrowUpCircle, ArrowDownCircle,
  DollarSign, AlertCircle, Eye, Trash2, CreditCard, Building2, ArrowRightLeft,
  CheckCircle2, Clock, XCircle, Upload, X, ChevronDown, ChevronUp, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/ui/stats-card'
import { formatCurrency } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────

interface Cliente { id: number; nombre: string }
interface Proyecto { id: number; nombre: string }
interface Factura {
  id: number; numero: string; ncf: string | null; tipo: string
  fecha: string; fechaVencimiento: string | null
  proveedor: string | null; rncProveedor: string | null
  clienteId: number | null; cliente: Cliente | null
  destinoTipo: string; proyectoId: number | null; proyecto: Proyecto | null
  descripcion: string | null
  subtotal: number; impuesto: number; total: number; montoPagado: number
  estado: string; archivoUrl: string | null; observaciones: string | null
  _count: { pagos: number }
}
interface CuentaBancaria {
  id: number; nombre: string; banco: string; numeroCuenta: string | null
  tipoCuenta: string; moneda: string; saldoInicial: number; activa: boolean
  saldoActual?: number
}
interface Resumen {
  totalIngresos: number; totalEgresos: number
  cobrado: number; pagado: number; porCobrar: number; porPagar: number
}

interface Props {
  facturasIniciales: Factura[]
  cuentasIniciales: CuentaBancaria[]
  clientes: Cliente[]
  resumen: Resumen
}

type Tab = 'dashboard' | 'facturas' | 'cuentas' | 'conciliacion'

const ESTADOS_BADGE: Record<string, { color: string; icon: any }> = {
  pendiente: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  parcial: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: ArrowRightLeft },
  pagada: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  anulada: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
}

// ── Component ────────────────────────────────────────────────────────────

export function ContabilidadClient({ facturasIniciales, cuentasIniciales, clientes, resumen }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [facturas, setFacturas] = useState(facturasIniciales)
  const [cuentas, setCuentas] = useState(cuentasIniciales)

  // Filters
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  // Modals
  const [showFacturaForm, setShowFacturaForm] = useState(false)
  const [showCuentaForm, setShowCuentaForm] = useState(false)
  const [editingCuenta, setEditingCuenta] = useState<CuentaBancaria | null>(null)

  // ── Filter facturas ──
  const facturasFiltradas = facturas.filter((f) => {
    if (filtroTipo && f.tipo !== filtroTipo) return false
    if (filtroEstado && f.estado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const match = f.numero.toLowerCase().includes(q) ||
        f.ncf?.toLowerCase().includes(q) ||
        f.proveedor?.toLowerCase().includes(q) ||
        f.cliente?.nombre.toLowerCase().includes(q) ||
        f.descripcion?.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  // ── Delete factura ──
  const handleDeleteFactura = async (id: number) => {
    if (!confirm('¿Eliminar esta factura? Se eliminarán sus pagos también.')) return
    const res = await fetch(`/api/contabilidad/facturas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFacturas((prev) => prev.filter((f) => f.id !== id))
      router.refresh()
    }
  }

  // ── Delete cuenta ──
  const handleDeleteCuenta = async (id: number) => {
    if (!confirm('¿Desactivar esta cuenta bancaria?')) return
    const res = await fetch(`/api/contabilidad/cuentas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCuentas((prev) => prev.filter((c) => c.id !== id))
    }
  }

  // ── Tabs ──
  const tabs = [
    { key: 'dashboard' as Tab, label: 'Resumen', icon: <Landmark className="w-3.5 h-3.5" /> },
    { key: 'facturas' as Tab, label: 'Facturas', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'cuentas' as Tab, label: 'Cuentas', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'conciliacion' as Tab, label: 'Conciliación', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6" /> Contabilidad
          </h1>
          <p className="text-sm text-muted-foreground">Facturas, pagos y conciliación bancaria</p>
        </div>
        <div className="flex gap-2">
          {tab === 'facturas' && (
            <Link href="/contabilidad/facturas/nueva">
              <Button><Plus className="w-4 h-4" /> Nueva Factura</Button>
            </Link>
          )}
          {tab === 'cuentas' && (
            <Button onClick={() => { setEditingCuenta(null); setShowCuentaForm(true) }}>
              <Plus className="w-4 h-4" /> Nueva Cuenta
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Por Cobrar"
              value={formatCurrency(resumen.porCobrar)}
              icon={<ArrowUpCircle className="w-5 h-5" />}
              colorClass="bg-green-500/10 text-green-500"
              description={`Total facturado: ${formatCurrency(resumen.totalIngresos)}`}
            />
            <StatsCard
              title="Por Pagar"
              value={formatCurrency(resumen.porPagar)}
              icon={<ArrowDownCircle className="w-5 h-5" />}
              colorClass="bg-red-500/10 text-red-500"
              description={`Total gastos: ${formatCurrency(resumen.totalEgresos)}`}
            />
            <StatsCard
              title="Cobrado"
              value={formatCurrency(resumen.cobrado)}
              icon={<DollarSign className="w-5 h-5" />}
              colorClass="bg-blue-500/10 text-blue-500"
            />
            <StatsCard
              title="Pagado"
              value={formatCurrency(resumen.pagado)}
              icon={<CreditCard className="w-5 h-5" />}
              colorClass="bg-purple-500/10 text-purple-500"
            />
          </div>

          {/* Recent invoices */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4">Facturas recientes</h3>
            <div className="space-y-2">
              {facturas.slice(0, 10).map((f) => {
                const badge = ESTADOS_BADGE[f.estado] || ESTADOS_BADGE.pendiente
                const BadgeIcon = badge.icon
                return (
                  <Link key={f.id} href={`/contabilidad/facturas/${f.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${f.tipo === 'ingreso' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {f.tipo === 'ingreso' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          #{f.numero} — {f.tipo === 'ingreso' ? f.cliente?.nombre || 'Sin cliente' : f.proveedor || 'Sin proveedor'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(f.fecha).toLocaleDateString('es-DO')}
                          {f.ncf && <span className="ml-2 font-mono">{f.ncf}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" /> {f.estado}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(f.total)}</span>
                    </div>
                  </Link>
                )
              })}
              {facturas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No hay facturas registradas</p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/contabilidad/facturas/nueva">
              <div className="p-4 bg-card border border-border rounded-xl hover:bg-muted/40 transition-colors cursor-pointer text-center">
                <Plus className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium">Nueva Factura</p>
              </div>
            </Link>
            <button onClick={() => setTab('facturas')} className="p-4 bg-card border border-border rounded-xl hover:bg-muted/40 transition-colors text-center w-full">
              <FileText className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Ver Facturas</p>
            </button>
            <button onClick={() => setTab('cuentas')} className="p-4 bg-card border border-border rounded-xl hover:bg-muted/40 transition-colors text-center w-full">
              <Building2 className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Cuentas Bancarias</p>
            </button>
            <button onClick={() => setTab('conciliacion')} className="p-4 bg-card border border-border rounded-xl hover:bg-muted/40 transition-colors text-center w-full">
              <ArrowRightLeft className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-sm font-medium">Conciliación</p>
            </button>
          </div>
        </div>
      )}

      {/* ── Facturas ── */}
      {tab === 'facturas' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por número, NCF, proveedor, cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card">
              <option value="">Todos los tipos</option>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card">
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagada">Pagada</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{facturasFiltradas.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Pendientes</p>
              <p className="text-lg font-bold text-yellow-600">{facturasFiltradas.filter(f => f.estado === 'pendiente').length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Facturado</p>
              <p className="text-lg font-bold">{formatCurrency(facturasFiltradas.reduce((s, f) => s + f.total, 0))}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo pend.</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(facturasFiltradas.reduce((s, f) => s + (f.total - f.montoPagado), 0))}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Número</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Cliente/Proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">NCF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Destino</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Pagado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {facturasFiltradas.map((f) => {
                    const badge = ESTADOS_BADGE[f.estado] || ESTADOS_BADGE.pendiente
                    const BadgeIcon = badge.icon
                    return (
                      <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium font-mono">{f.numero}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${f.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                            {f.tipo === 'ingreso' ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                            {f.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date(f.fecha).toLocaleDateString('es-DO')}</td>
                        <td className="px-4 py-3">{f.tipo === 'ingreso' ? f.cliente?.nombre || '—' : f.proveedor || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{f.ncf || '—'}</td>
                        <td className="px-4 py-3 text-xs">
                          {f.proyecto ? (
                            <span className="text-primary">{f.proyecto.nombre}</span>
                          ) : (
                            <span className="capitalize text-muted-foreground">{f.destinoTipo}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(f.total)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(f.montoPagado)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                            <BadgeIcon className="w-3 h-3" /> {f.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Link href={`/contabilidad/facturas/${f.id}`}>
                              <Button variant="ghost" size="sm"><Eye className="w-3.5 h-3.5" /></Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteFactura(f.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {facturasFiltradas.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No se encontraron facturas</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Cuentas ── */}
      {tab === 'cuentas' && (
        <div className="space-y-4">
          {showCuentaForm && (
            <CuentaFormInline
              cuenta={editingCuenta}
              onClose={() => { setShowCuentaForm(false); setEditingCuenta(null) }}
              onSaved={() => { setShowCuentaForm(false); setEditingCuenta(null); router.refresh() }}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuentas.map((c) => (
              <CuentaCard
                key={c.id}
                cuenta={c}
                onEdit={() => { setEditingCuenta(c); setShowCuentaForm(true) }}
                onDelete={() => handleDeleteCuenta(c.id)}
              />
            ))}
            {cuentas.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No hay cuentas bancarias registradas</p>
                <Button className="mt-3" onClick={() => setShowCuentaForm(true)}><Plus className="w-4 h-4" /> Agregar cuenta</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Conciliación ── */}
      {tab === 'conciliacion' && (
        <ConciliacionTab cuentas={cuentas} />
      )}
    </div>
  )
}

// ── Cuenta Card with expandable movements ───────────────────────────────

function CuentaCard({ cuenta: c, onEdit, onDelete }: { cuenta: CuentaBancaria; onEdit: () => void; onDelete: () => void }) {
  const esTarjeta = c.tipoCuenta === 'tarjeta_credito'
  const [expanded, setExpanded] = useState(false)
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const handleToggle = async () => {
    if (!expanded && !loaded) {
      setLoading(true)
      const res = await fetch(`/api/contabilidad/cuentas/${c.id}/movimientos`)
      if (res.ok) setMovimientos(await res.json())
      setLoaded(true)
      setLoading(false)
    }
    setExpanded(!expanded)
  }

  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden ${expanded ? 'col-span-full' : ''}`}>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{c.nombre}</h3>
            <p className="text-sm text-muted-foreground">{c.banco}</p>
          </div>
          <div className={`p-2 rounded-lg ${esTarjeta ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
            {esTarjeta ? <CreditCard className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${esTarjeta ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
            {esTarjeta ? 'Tarjeta de Crédito' : c.tipoCuenta === 'ahorro' ? 'Ahorro' : 'Corriente'}
          </span>
          {c.numeroCuenta && <span className="text-xs font-mono text-muted-foreground">{c.numeroCuenta}</span>}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">{esTarjeta ? 'Deuda actual' : 'Saldo actual'}</p>
            <p className={`text-lg font-bold tabular-nums ${esTarjeta && (c.saldoActual ?? 0) > 0 ? 'text-red-500' : ''}`}>
              {formatCurrency(c.saldoActual ?? c.saldoInicial)}
            </p>
            {esTarjeta && (
              <p className="text-[10px] text-muted-foreground">Límite: {formatCurrency(c.saldoInicial)}</p>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleToggle} title="Ver movimientos">
              <List className="w-3.5 h-3.5" />
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {loading && <p className="px-5 py-4 text-sm text-muted-foreground">Cargando movimientos...</p>}
          {!loading && movimientos.length === 0 && (
            <p className="px-5 py-6 text-sm text-center text-muted-foreground">No hay movimientos</p>
          )}
          {!loading && movimientos.length > 0 && (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Descripción</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Ref.</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Monto</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movimientos.map((m: any) => (
                    <tr key={m.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo === 'credito' ? 'Crédito' : 'Débito'}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-[300px] truncate">{m.descripcion}</td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{m.referencia || '—'}</td>
                      <td className={`px-4 py-2 text-right font-semibold tabular-nums whitespace-nowrap ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                        {m.tipo === 'credito' ? '+' : '-'}{formatCurrency(m.monto)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {m.conciliado ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3 h-3" /> Conciliado</span>
                        ) : (
                          <span className="text-xs text-yellow-600"><Clock className="w-3 h-3 inline" /> Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex justify-between">
                <span>{movimientos.length} movimientos</span>
                <span>
                  Créditos: <span className="text-green-600 font-medium">{formatCurrency(movimientos.filter((m: any) => m.tipo === 'credito').reduce((s: number, m: any) => s + m.monto, 0))}</span>
                  {' · '}
                  Débitos: <span className="text-red-600 font-medium">{formatCurrency(movimientos.filter((m: any) => m.tipo === 'debito').reduce((s: number, m: any) => s + m.monto, 0))}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Cuenta Form Inline ───────────────────────────────────────────────────

function CuentaFormInline({ cuenta, onClose, onSaved }: { cuenta: CuentaBancaria | null; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(cuenta?.nombre || '')
  const [banco, setBanco] = useState(cuenta?.banco || '')
  const [numeroCuenta, setNumeroCuenta] = useState(cuenta?.numeroCuenta || '')
  const [tipoCuenta, setTipoCuenta] = useState(cuenta?.tipoCuenta || 'corriente')
  const [moneda, setMoneda] = useState(cuenta?.moneda || 'RD$')
  const [saldoInicial, setSaldoInicial] = useState(cuenta?.saldoInicial?.toString() || '0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const payload = { nombre, banco, numeroCuenta: numeroCuenta || null, tipoCuenta, moneda, saldoInicial: parseFloat(saldoInicial) || 0 }

    const url = cuenta ? `/api/contabilidad/cuentas/${cuenta.id}` : '/api/contabilidad/cuentas'
    const method = cuenta ? 'PUT' : 'POST'

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json()
      setError(d.error || 'Error')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{cuenta ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Banco *</label>
          <input value={banco} onChange={(e) => setBanco(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Número de cuenta</label>
          <input value={numeroCuenta} onChange={(e) => setNumeroCuenta(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select value={tipoCuenta} onChange={(e) => setTipoCuenta(e.target.value)} className={inputCls}>
            <option value="corriente">Corriente</option>
            <option value="ahorro">Ahorro</option>
            <option value="tarjeta_credito">Tarjeta de Crédito</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Moneda</label>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={inputCls}>
            <option value="RD$">RD$</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{tipoCuenta === 'tarjeta_credito' ? 'Límite de crédito' : 'Saldo inicial'}</label>
          <input type="number" step="0.01" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-full flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : (cuenta ? 'Actualizar' : 'Crear Cuenta')}</Button>
        </div>
      </form>
    </div>
  )
}

// ── Conciliación Tab ─────────────────────────────────────────────────────

function ConciliacionTab({ cuentas }: { cuentas: CuentaBancaria[] }) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id?.toString() || '')
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([])
  const importRef = useRef<HTMLInputElement>(null)

  const fetchMovimientos = useCallback(async () => {
    if (!cuentaId) return
    setLoading(true)
    const res = await fetch(`/api/contabilidad/cuentas/${cuentaId}/movimientos`)
    if (res.ok) setMovimientos(await res.json())
    setLoading(false)
  }, [cuentaId])

  const fetchFacturas = useCallback(async () => {
    // Load all non-anulada facturas for conciliation matching
    const res = await fetch('/api/contabilidad/facturas')
    if (res.ok) {
      const data = await res.json()
      setFacturasDisponibles(data.facturas || [])
    }
  }, [])

  const handleConciliar = async (movimientoId: number, facturaId: number | null) => {
    const res = await fetch('/api/contabilidad/conciliacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movimientoId, facturaId }),
    })
    if (res.ok) fetchMovimientos()
  }

  const handleDeleteMovimiento = async (movId: number) => {
    if (!confirm('¿Eliminar este movimiento?')) return
    const res = await fetch(`/api/contabilidad/cuentas/${cuentaId}/movimientos/${movId}`, { method: 'DELETE' })
    if (res.ok) fetchMovimientos()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !cuentaId) return
    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('archivo', file)
    formData.append('cuentaId', cuentaId)

    try {
      const res = await fetch('/api/contabilidad/importar-extracto', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`${data.importados} importados, ${data.duplicados} duplicados de ${data.total} líneas`)
        fetchMovimientos()
      } else {
        setImportResult(`Error: ${data.error}`)
      }
    } catch (err: any) {
      setImportResult(`Error: ${err.message}`)
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  // Load on mount and when account changes
  useState(() => { if (cuentaId) { fetchMovimientos(); fetchFacturas() } })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={cuentaId} onChange={(e) => { setCuentaId(e.target.value) }}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-card min-w-[250px]">
          <option value="">Seleccionar cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>
          ))}
        </select>
        <Button variant="outline" onClick={fetchMovimientos} disabled={!cuentaId}>Cargar</Button>
        <Button onClick={() => { setShowAddForm(!showAddForm); setShowTransferForm(false) }} disabled={!cuentaId}>
          <Plus className="w-4 h-4" /> Movimiento
        </Button>
        <Button variant="outline" onClick={() => { setShowTransferForm(!showTransferForm); setShowAddForm(false) }}>
          <ArrowRightLeft className="w-4 h-4" /> Transferencia
        </Button>
        <Button variant="outline" onClick={() => importRef.current?.click()} disabled={!cuentaId || importing}>
          <Upload className="w-4 h-4" /> {importing ? 'Importando...' : 'Importar Extracto'}
        </Button>
        <input ref={importRef} type="file" accept=".txt,.csv" onChange={handleImport} className="hidden" />
      </div>

      {importResult && (
        <div className={`p-3 rounded-lg text-sm ${importResult.startsWith('Error') ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'}`}>
          {importResult}
        </div>
      )}

      {showAddForm && cuentaId && (
        <MovimientoForm
          cuentaId={parseInt(cuentaId)}
          onClose={() => setShowAddForm(false)}
          onSaved={() => { setShowAddForm(false); fetchMovimientos() }}
        />
      )}

      {showTransferForm && (
        <TransferenciaForm
          cuentas={cuentas}
          cuentaOrigenId={cuentaId}
          onClose={() => setShowTransferForm(false)}
          onSaved={() => { setShowTransferForm(false); fetchMovimientos() }}
        />
      )}

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}

      {!loading && movimientos.length > 0 && (
        <>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Movimientos</p>
            <p className="text-lg font-bold">{movimientos.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Créditos</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(movimientos.filter((m: any) => m.tipo === 'credito').reduce((s: number, m: any) => s + m.monto, 0))}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Débitos</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(movimientos.filter((m: any) => m.tipo === 'debito').reduce((s: number, m: any) => s + m.monto, 0))}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Sin conciliar</p>
            <p className="text-lg font-bold text-yellow-600">{movimientos.filter((m: any) => !m.conciliado).length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Referencia</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Monto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Conciliado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Factura</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movimientos.map((m: any) => (
                <tr key={m.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground">{new Date(m.fecha).toLocaleDateString('es-DO')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{m.descripcion}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.referencia || '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.tipo === 'credito' ? '+' : '-'}{formatCurrency(m.monto)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.conciliado ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sí
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.factura ? (
                      <div className="flex items-center gap-1 justify-center">
                        <Link href={`/contabilidad/facturas/${m.factura.id}`} className="text-xs text-primary hover:underline">
                          #{m.factura.numero}
                        </Link>
                        <button onClick={() => handleConciliar(m.id, null)} className="text-muted-foreground hover:text-red-500" title="Desvincular">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <select
                        className={`text-xs border rounded px-1 py-0.5 bg-card ${
                          facturasDisponibles.some((f: any) => f.estado !== 'anulada' && Math.abs(f.total - m.monto) < 0.02)
                            ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-border'
                        }`}
                        value=""
                        onChange={(e) => { if (e.target.value) handleConciliar(m.id, parseInt(e.target.value)) }}
                      >
                        <option value="">Vincular...</option>
                        {/* Show matching amounts first */}
                        {facturasDisponibles
                          .filter((f: any) => f.estado !== 'anulada')
                          .sort((a: any, b: any) => {
                            const aMatch = Math.abs(a.total - m.monto) < 0.02 ? 0 : 1
                            const bMatch = Math.abs(b.total - m.monto) < 0.02 ? 0 : 1
                            return aMatch - bMatch
                          })
                          .map((f: any) => {
                            const montoMatch = Math.abs(f.total - m.monto) < 0.02
                            return (
                              <option key={f.id} value={f.id}>
                                {montoMatch ? '✓ ' : ''}#{f.numero} — {formatCurrency(f.total)} — {f.proveedor || f.cliente?.nombre || 'Sin nombre'} [{f.estado}]
                              </option>
                            )
                          })}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDeleteMovimiento(m.id)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Eliminar movimiento">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {!loading && movimientos.length === 0 && cuentaId && (
        <div className="text-center py-12 text-muted-foreground">
          <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No hay movimientos registrados en esta cuenta</p>
        </div>
      )}
    </div>
  )
}

// ── Movimiento Form ──────────────────────────────────────────────────────

function MovimientoForm({ cuentaId, onClose, onSaved }: { cuentaId: number; onClose: () => void; onSaved: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('debito')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch(`/api/contabilidad/cuentas/${cuentaId}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, tipo, monto: parseFloat(monto) || 0, descripcion, referencia: referencia || null }),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error || 'Error')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Nuevo Movimiento Bancario</h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="debito">Débito (salida)</option>
            <option value="credito">Crédito (entrada)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Monto *</label>
          <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Descripción *</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Referencia</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-full flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Agregar'}</Button>
        </div>
      </form>
    </div>
  )
}

// ── Transferencia Form ──────────────────────────────────────────────────

function TransferenciaForm({ cuentas, cuentaOrigenId, onClose, onSaved }: {
  cuentas: CuentaBancaria[]; cuentaOrigenId: string; onClose: () => void; onSaved: () => void
}) {
  const [origenId, setOrigenId] = useState(cuentaOrigenId)
  const [destinoId, setDestinoId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const origen = cuentas.find(c => c.id.toString() === origenId)
  const destino = cuentas.find(c => c.id.toString() === destinoId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/contabilidad/transferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cuentaOrigenId: parseInt(origenId),
        cuentaDestinoId: parseInt(destinoId),
        monto: parseFloat(monto) || 0,
        fecha,
        descripcion: descripcion || undefined,
        referencia: referencia || undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setSuccess(data.message)
      setTimeout(() => onSaved(), 1500)
    } else {
      setError(data.error || 'Error al transferir')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="bg-card border border-purple-200 dark:border-purple-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-purple-500" /> Transferencia entre cuentas
        </h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Transfiere fondos entre cuentas. Ej: pago de tarjeta de crédito desde cuenta corriente.
      </p>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-3">{success}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cuenta origen (sale dinero) *</label>
            <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} className={inputCls} required>
              <option value="">Seleccionar...</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id.toString() === destinoId}>
                  {c.nombre} — {c.banco} {c.tipoCuenta === 'tarjeta_credito' ? '(TC)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cuenta destino (recibe dinero) *</label>
            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className={inputCls} required>
              <option value="">Seleccionar...</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id.toString() === origenId}>
                  {c.nombre} — {c.banco} {c.tipoCuenta === 'tarjeta_credito' ? '(TC)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {origen && destino && (
          <div className="flex items-center justify-center gap-3 py-2 text-sm">
            <span className="px-3 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-medium">{origen.nombre}</span>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            <span className="px-3 py-1 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium">{destino.nombre}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Monto *</label>
            <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} required placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} placeholder="Pago tarjeta, transferencia..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Referencia</label>
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} placeholder="Nro. referencia" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading || !origenId || !destinoId}>
            {loading ? 'Procesando...' : 'Realizar Transferencia'}
          </Button>
        </div>
      </form>
    </div>
  )
}
