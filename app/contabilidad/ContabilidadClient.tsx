'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/api-client'
import Link from 'next/link'
import { Landmark, FileText, Plus, Search, ArrowUpCircle, ArrowDownCircle, DollarSign, Eye, Trash2, CreditCard, Building2, ArrowRightLeft, CheckCircle2, Clock, XCircle, Upload, Truck, Layers, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatsCard } from '@/components/ui/stats-card'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { variantDeEstado, etiquetaDeEstado } from '@/lib/estados'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { CuentaCard, CuentaFormInline } from '@/components/contabilidad/CuentaCard'
// Tabs y modales pesados bajo demanda (F6): no viajan en el bundle inicial.
const tabLoading = () => <Skeleton className="h-64 w-full rounded-xl" />
const InformeEconomico = dynamic(() => import('@/components/contabilidad/InformeEconomico').then(m => m.InformeEconomico), { loading: tabLoading })
const ProveedoresTab = dynamic(() => import('@/components/contabilidad/ProveedoresTab').then(m => m.ProveedoresTab), { loading: tabLoading })
const ConciliacionTab = dynamic(() => import('@/components/contabilidad/ConciliacionTab').then(m => m.ConciliacionTab), { loading: tabLoading })

// ── Types ────────────────────────────────────────────────────────────────

import type { ClienteRef, FacturaLista, CuentaBancariaConSaldo, ResumenFacturas as Resumen } from '@/lib/types'

interface Props {
  facturasIniciales: FacturaLista[]
  cuentasIniciales: CuentaBancariaConSaldo[]
  clientes: ClienteRef[]
  resumen: Resumen
}

type Tab = 'dashboard' | 'resultado' | 'facturas' | 'cuentas' | 'conciliacion' | 'proveedores'

// Colores y etiquetas de estado: lib/estados.ts (dominio 'factura'). Aca solo el icono.
const ESTADO_ICONO: Record<string, React.ComponentType<{ className?: string }>> = {
  pendiente: Clock, parcial: ArrowRightLeft, pagada: CheckCircle2, anulada: XCircle,
}

// ── Component ────────────────────────────────────────────────────────────

export function ContabilidadClient({ facturasIniciales, cuentasIniciales, clientes, resumen: resumenInicial }: Props) {
  const toast = useToast()
  const queryClient = useQueryClient()
  // Tab activa persistida en la URL (?tab=): F5 y enlaces compartidos la conservan
  const [urlFilters, setUrlFilters] = useUrlFilters({ tab: 'dashboard' })
  const tab = urlFilters.tab as Tab
  const setTab = (t: Tab) => setUrlFilters({ tab: t })
  // Datos vivos via TanStack Query (F5): una sola fuente de verdad.
  // initialData = lo que ya trajo el server component (sin loading inicial);
  // las mutaciones invalidan el queryKey y la lista se refresca sola.
  const { data: facturasData } = useQuery({
    queryKey: ['contabilidad', 'facturas'],
    queryFn: () => fetchJson<{ facturas: FacturaLista[]; resumen: Resumen }>('/api/contabilidad/facturas'),
    initialData: { facturas: facturasIniciales, resumen: resumenInicial },
  })
  const facturas = facturasData.facturas
  const resumen = facturasData.resumen
  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad', 'cuentas'],
    queryFn: () => fetchJson<CuentaBancariaConSaldo[]>('/api/contabilidad/cuentas'),
    initialData: cuentasIniciales,
  })

  // Confirmación genérica para reemplazar el diálogo nativo del navegador
  const [confirmacion, setConfirmacion] = useState<{
    titulo: string
    descripcion?: string
    textoConfirmar?: string
    onConfirmar: () => void
  } | null>(null)

  // Filters
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  // Modals
  const [showCuentaForm, setShowCuentaForm] = useState(false)
  const [editingCuenta, setEditingCuenta] = useState<CuentaBancariaConSaldo | null>(null)

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
  const handleDeleteFactura = (id: number) => {
    setConfirmacion({
      titulo: '¿Eliminar esta factura?',
      descripcion: 'Se eliminarán sus pagos también.',
      textoConfirmar: 'Sí, eliminar',
      onConfirmar: async () => {
        setConfirmacion(null)
        const res = await fetch(`/api/contabilidad/facturas/${id}`, { method: 'DELETE' })
        if (res.ok) {
          toast.exito('Factura eliminada')
          queryClient.invalidateQueries({ queryKey: ['contabilidad', 'facturas'] })
        } else {
          const data = await res.json().catch(() => null)
          toast.error(data?.error ?? 'No se pudo eliminar la factura')
        }
      },
    })
  }

  // ── Delete cuenta ──
  const handleDeleteCuenta = (id: number) => {
    setConfirmacion({
      titulo: '¿Desactivar esta cuenta bancaria?',
      textoConfirmar: 'Sí, desactivar',
      onConfirmar: async () => {
        setConfirmacion(null)
        const res = await fetch(`/api/contabilidad/cuentas/${id}`, { method: 'DELETE' })
        if (res.ok) {
          toast.exito('Cuenta desactivada')
          queryClient.invalidateQueries({ queryKey: ['contabilidad', 'cuentas'] })
        } else {
          const data = await res.json().catch(() => null)
          toast.error(data?.error ?? 'No se pudo desactivar la cuenta')
        }
      },
    })
  }

  // ── Tabs ──
  const tabs = [
    { key: 'dashboard' as Tab, label: 'Resumen', icon: <Landmark className="w-3.5 h-3.5" /> },
    { key: 'resultado' as Tab, label: 'Resultado', icon: <DollarSign className="w-3.5 h-3.5" /> },
    { key: 'facturas' as Tab, label: 'Facturas', icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'cuentas' as Tab, label: 'Cuentas', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'conciliacion' as Tab, label: 'Conciliación', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
    { key: 'proveedores' as Tab, label: 'Proveedores', icon: <Truck className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6" /> Contabilidad
          </h1>
          <p className="text-sm text-muted-foreground">Facturas, pagos y conciliación bancaria</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {tab === 'facturas' && (
            <>
              <Link href="/contabilidad/facturas/resync-sharepoint" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full"><UploadCloud className="w-4 h-4" /> Re-sincronizar SP</Button>
              </Link>
              <Link href="/contabilidad/facturas/importar" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="w-full"><Upload className="w-4 h-4" /> Importar CSV</Button>
              </Link>
              <Link href="/contabilidad/facturas/nueva" className="flex-1 sm:flex-none">
                <Button className="w-full"><Plus className="w-4 h-4" /> Nueva Factura</Button>
              </Link>
            </>
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
                const BadgeIcon = ESTADO_ICONO[f.estado] ?? Clock
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
                          {new Date(f.fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' })}
                          {f.ncf && <span className="ml-2 font-mono">{f.ncf}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={variantDeEstado('factura', f.estado)} className="gap-1">
                        <BadgeIcon className="w-3 h-3" /> {etiquetaDeEstado('factura', f.estado)}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(f.total)}</span>
                    </div>
                  </Link>
                )
              })}
              {facturas.length === 0 && (
                <EmptyState
                  compacto
                  icon={FileText}
                  titulo="No hay facturas registradas"
                  accion={{ label: 'Nueva Factura', href: '/contabilidad/facturas/nueva', icono: Plus }}
                />
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/contabilidad/overhead">
              <div className="p-4 bg-primary/5 border border-primary/30 rounded-xl hover:bg-primary/10 transition-colors cursor-pointer text-center">
                <Layers className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium">Overhead distribuido</p>
              </div>
            </Link>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente/Proveedor</TableHead>
                  <TableHead>NCF</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturasFiltradas.map((f) => {
                  const BadgeIcon = ESTADO_ICONO[f.estado] ?? Clock
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium font-mono">{f.numero}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${f.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                          {f.tipo === 'ingreso' ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}
                          {f.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{new Date(f.fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</TableCell>
                      <TableCell>{f.tipo === 'ingreso' ? f.cliente?.nombre || '—' : f.proveedor || '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{f.ncf || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {f.proyecto ? (
                          <span className="text-primary">{f.proyecto.nombre}</span>
                        ) : (
                          <span className="capitalize text-muted-foreground">{f.destinoTipo}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(f.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(f.montoPagado)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={variantDeEstado('factura', f.estado)} className="gap-1">
                          <BadgeIcon className="w-3 h-3" /> {etiquetaDeEstado('factura', f.estado)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/contabilidad/facturas/${f.id}`}>
                            <Button variant="ghost" size="sm" aria-label={`Ver factura ${f.numero}`}><Eye className="w-3.5 h-3.5" /></Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteFactura(f.id)} aria-label={`Eliminar factura ${f.numero}`}>
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {facturasFiltradas.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">No se encontraron facturas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
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
              onSaved={() => { setShowCuentaForm(false); setEditingCuenta(null); queryClient.invalidateQueries({ queryKey: ['contabilidad', 'cuentas'] }) }}
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
              <div className="col-span-full">
                <EmptyState
                  icon={Building2}
                  titulo="No hay cuentas bancarias registradas"
                  descripcion="Registra las cuentas del negocio para conciliar movimientos y pagos."
                  accion={{ label: 'Agregar cuenta', onClick: () => setShowCuentaForm(true), icono: Plus }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Conciliación ── */}
      {tab === 'conciliacion' && (
        <ConciliacionTab cuentas={cuentas} clientes={clientes} />
      )}

      {/* ── Resultado (Informe Económico) ── */}
      {tab === 'resultado' && (
        <InformeEconomico />
      )}

      {/* ── Proveedores ── */}
      {tab === 'proveedores' && (
        <ProveedoresTab />
      )}

      <ConfirmDialog
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        descripcion={confirmacion?.descripcion}
        textoConfirmar={confirmacion?.textoConfirmar ?? 'Confirmar'}
        variante="peligro"
        onConfirmar={() => confirmacion?.onConfirmar()}
        onCancelar={() => setConfirmacion(null)}
      />
    </div>
  )
}

