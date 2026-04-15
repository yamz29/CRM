'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus, Search, Filter, Download, TrendingUp, TrendingDown, Clock,
  FileText, Briefcase, ExternalLink, Receipt, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { NuevaTransaccionModal } from './NuevaTransaccionModal'

interface Transaccion {
  id: string
  tipo: 'ingreso' | 'egreso'
  fuente: 'factura' | 'gasto' | 'ambos'
  facturaId: number | null
  gastoId: number | null
  fecha: string
  numero: string | null
  ncf: string | null
  descripcion: string
  proveedor: string | null
  cliente: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string } | null
  partidaId: number | null
  destinoTipo: string
  monto: number
  montoPagado: number
  estadoPago: string
  metodoPago: string | null
  archivoUrl: string | null
  driveUrl: string | null
}

interface Resumen {
  totalIngresos: number
  totalEgresos: number
  totalPagado: number
  porCobrar: number
  porPagar: number
  cantidad: number
}

interface Props {
  proyectos: { id: number; nombre: string }[]
  clientes: { id: number; nombre: string }[]
  proveedores: { id: number; nombre: string; rnc: string | null }[]
}

const FUENTE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  factura: { label: 'Factura', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  gasto:   { label: 'Gasto',   color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  ambos:   { label: 'Factura+Gasto', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
}

const ESTADO_PAGO_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  parcial:   { label: 'Parcial',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pagada:    { label: 'Pagada',     color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  anulada:   { label: 'Anulada',    color: 'bg-muted text-muted-foreground' },
  'n/a':     { label: '—',           color: 'bg-muted text-muted-foreground' },
}

export function TransaccionesClient({ proyectos, clientes, proveedores }: Props) {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNuevo, setShowNuevo] = useState(false)

  // Filtros
  const [tipoFilter, setTipoFilter] = useState<'' | 'ingreso' | 'egreso'>('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [fuenteFilter, setFuenteFilter] = useState<'' | 'factura' | 'gasto'>('')
  const [proyectoFilter, setProyectoFilter] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (tipoFilter) params.set('tipo', tipoFilter)
    if (estadoFilter) params.set('estado', estadoFilter)
    if (fuenteFilter) params.set('fuente', fuenteFilter)
    if (proyectoFilter) params.set('proyectoId', proyectoFilter)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (q.trim()) params.set('q', q.trim())
    const res = await fetch(`/api/contabilidad/transacciones?${params.toString()}`)
    if (res.ok) {
      const data = await res.json()
      setTransacciones(data.transacciones)
      setResumen(data.resumen)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load()
  }

  function exportCSV() {
    const headers = ['Fecha', 'Tipo', 'Fuente', 'Número', 'NCF', 'Descripción', 'Proveedor/Cliente', 'Proyecto', 'Monto', 'Pagado', 'Estado']
    const rows = transacciones.map(t => [
      new Date(t.fecha).toLocaleDateString('es-DO'),
      t.tipo,
      FUENTE_CONFIG[t.fuente]?.label ?? t.fuente,
      t.numero ?? '',
      t.ncf ?? '',
      t.descripcion,
      t.proveedor || t.cliente?.nombre || '',
      t.proyecto?.nombre ?? '',
      t.monto,
      t.montoPagado,
      ESTADO_PAGO_CONFIG[t.estadoPago]?.label ?? t.estadoPago,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transacciones-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const balance = useMemo(() => {
    if (!resumen) return 0
    return resumen.totalIngresos - resumen.totalEgresos
  }, [resumen])

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transacciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vista unificada de facturas contables y gastos de proyectos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setShowNuevo(true)}>
            <Plus className="w-4 h-4" /> Nueva transacción
          </Button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard icon={TrendingUp} label="Ingresos" value={formatCurrency(resumen.totalIngresos)} color="text-green-600" bg="bg-green-500/10" />
          <MetricCard icon={TrendingDown} label="Egresos" value={formatCurrency(resumen.totalEgresos)} color="text-red-600" bg="bg-red-500/10" />
          <MetricCard
            icon={TrendingUp}
            label="Balance"
            value={formatCurrency(balance)}
            color={balance >= 0 ? 'text-green-600' : 'text-red-600'}
            bg={balance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}
          />
          <MetricCard icon={Clock} label="Por cobrar" value={formatCurrency(resumen.porCobrar)} color="text-blue-600" bg="bg-blue-500/10" />
          <MetricCard icon={Clock} label="Por pagar" value={formatCurrency(resumen.porPagar)} color="text-amber-600" bg="bg-amber-500/10" />
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-3">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar por número, NCF, descripción, proveedor..."
                  className="w-full h-8 pl-8 pr-3 text-sm border border-border rounded-lg bg-input"
                />
              </div>
              <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value as '' | 'ingreso' | 'egreso')}
                className="h-8 text-sm border border-border rounded-lg px-2 bg-input">
                <option value="">Todos los tipos</option>
                <option value="ingreso">Ingresos</option>
                <option value="egreso">Egresos</option>
              </select>
              <select value={fuenteFilter} onChange={e => setFuenteFilter(e.target.value as '' | 'factura' | 'gasto')}
                className="h-8 text-sm border border-border rounded-lg px-2 bg-input">
                <option value="">Todas las fuentes</option>
                <option value="factura">Con factura (solo)</option>
                <option value="gasto">Sin factura</option>
              </select>
              <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}
                className="h-8 text-sm border border-border rounded-lg px-2 bg-input">
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={proyectoFilter} onChange={e => setProyectoFilter(e.target.value)}
                className="h-8 text-sm border border-border rounded-lg px-2 bg-input max-w-xs">
                <option value="">Todos los proyectos</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Desde:</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                  className="h-8 text-sm border border-border rounded-lg px-2 bg-input" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground">Hasta:</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                  className="h-8 text-sm border border-border rounded-lg px-2 bg-input" />
              </div>
              <Button type="submit" size="sm">
                <Filter className="w-3.5 h-3.5" /> Aplicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando transacciones...
            </div>
          ) : transacciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Sin transacciones para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Fuente</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Núm / NCF</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Proveedor / Cliente</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Monto</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transacciones.map(t => {
                    const fuenteCfg = FUENTE_CONFIG[t.fuente]
                    const estadoCfg = ESTADO_PAGO_CONFIG[t.estadoPago] ?? ESTADO_PAGO_CONFIG['n/a']
                    return (
                      <tr key={t.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(t.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-3 py-2">
                          {t.tipo === 'ingreso' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                              <TrendingUp className="w-3 h-3" /> Ingreso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                              <TrendingDown className="w-3 h-3" /> Egreso
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${fuenteCfg.bg} ${fuenteCfg.color}`}>
                            {fuenteCfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                          <div>{t.numero ?? '—'}</div>
                          {t.ncf && <div className="text-[10px] text-muted-foreground/60">NCF: {t.ncf}</div>}
                        </td>
                        <td className="px-3 py-2 text-foreground max-w-xs truncate" title={t.descripcion}>{t.descripcion}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs max-w-[120px] truncate">
                          {t.proveedor || t.cliente?.nombre || '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {t.proyecto ? (
                            <Link href={`/proyectos/${t.proyecto.id}`} className="hover:text-primary inline-flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{t.proyecto.nombre}</span>
                            </Link>
                          ) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${t.tipo === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(t.monto)}
                          {t.montoPagado > 0 && t.montoPagado < t.monto && (
                            <div className="text-[10px] text-muted-foreground font-normal">
                              Pagado: {formatCurrency(t.montoPagado)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${estadoCfg.color}`}>
                            {estadoCfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            {t.facturaId && (
                              <Link href={`/contabilidad/facturas/${t.facturaId}`}
                                className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-muted"
                                title="Ver factura">
                                <FileText className="w-3.5 h-3.5" />
                              </Link>
                            )}
                            {t.archivoUrl && (
                              <a href={t.archivoUrl} target="_blank" rel="noopener noreferrer"
                                className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-muted"
                                title="Ver archivo">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showNuevo && (
        <NuevaTransaccionModal
          proyectos={proyectos}
          clientes={clientes}
          proveedores={proveedores}
          onClose={() => setShowNuevo(false)}
          onSuccess={() => { setShowNuevo(false); load() }}
        />
      )}
    </>
  )
}

function MetricCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string; color: string; bg: string
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-sm font-black tabular-nums truncate ${color}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
