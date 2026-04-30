'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Printer, Eye, FileText, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react'

interface Factura {
  id: number
  numero: string
  ncf: string | null
  fecha: string
  fechaVencimiento: string | null
  total: number
  montoPagado: number
  estado: string
  esProforma: boolean
  cliente: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string; codigo: string | null } | null
  descripcion: string | null
}

interface Resumen {
  totalFacturado: number
  totalCobrado: number
  porCobrar: number
  proformas: number
}

interface Props {
  facturas: Factura[]
  resumen: Resumen
}

type FiltroEstado = 'todas' | 'pendiente' | 'parcial' | 'pagada' | 'anulada' | 'proforma'

const ESTADO_CONFIG: Record<string, { color: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendiente: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', label: 'Pendiente', icon: Clock },
  parcial:   { color: 'bg-blue-100  text-blue-800  dark:bg-blue-900/30  dark:text-blue-300',   label: 'Parcial',   icon: Clock },
  pagada:    { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',  label: 'Pagada',    icon: CheckCircle2 },
  anulada:   { color: 'bg-red-100   text-red-800   dark:bg-red-900/30   dark:text-red-300',    label: 'Anulada',   icon: Ban },
}

export function FacturacionClient({ facturas, resumen }: Props) {
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const filtradas = useMemo(() => {
    return facturas.filter(f => {
      if (filtroEstado === 'proforma') {
        if (!f.esProforma) return false
      } else if (filtroEstado !== 'todas') {
        if (f.estado !== filtroEstado) return false
      }

      if (filtroDesde) {
        const d = new Date(filtroDesde + 'T00:00:00')
        if (new Date(f.fecha) < d) return false
      }
      if (filtroHasta) {
        const h = new Date(filtroHasta + 'T23:59:59')
        if (new Date(f.fecha) > h) return false
      }

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        const haystack = [
          f.numero,
          f.ncf ?? '',
          f.cliente?.nombre ?? '',
          f.proyecto?.nombre ?? '',
          f.proyecto?.codigo ?? '',
          f.descripcion ?? '',
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [facturas, filtroEstado, busqueda, filtroDesde, filtroHasta])

  const counts = useMemo(() => ({
    todas: facturas.length,
    pendiente: facturas.filter(f => f.estado === 'pendiente').length,
    parcial: facturas.filter(f => f.estado === 'parcial').length,
    pagada: facturas.filter(f => f.estado === 'pagada').length,
    anulada: facturas.filter(f => f.estado === 'anulada').length,
    proforma: facturas.filter(f => f.esProforma).length,
  }), [facturas])

  return (
    <>
      {/* Cards resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Facturado</p>
          <p className="text-2xl font-black mt-0.5 text-foreground">{formatCurrency(resumen.totalFacturado)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Cobrado</p>
          <p className="text-2xl font-black mt-0.5 text-green-600 dark:text-green-400">{formatCurrency(resumen.totalCobrado)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Por cobrar</p>
          <p className={`text-2xl font-black mt-0.5 ${resumen.porCobrar > 0.01 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {formatCurrency(resumen.porCobrar)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground font-medium">Proformas activas</p>
          <p className="text-2xl font-black mt-0.5 text-foreground">{resumen.proformas}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { v: 'todas', label: `Todas (${counts.todas})` },
            { v: 'pendiente', label: `Pendientes (${counts.pendiente})` },
            { v: 'parcial', label: `Parciales (${counts.parcial})` },
            { v: 'pagada', label: `Pagadas (${counts.pagada})` },
            { v: 'proforma', label: `Proformas (${counts.proforma})` },
            { v: 'anulada', label: `Anuladas (${counts.anulada})` },
          ] as const).map(f => (
            <button
              key={f.v}
              onClick={() => setFiltroEstado(f.v)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filtroEstado === f.v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border border-border hover:bg-muted/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px] border border-border rounded-md px-2 py-1 bg-background">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por número, NCF, cliente, proyecto…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <input
            type="date"
            value={filtroDesde}
            onChange={e => setFiltroDesde(e.target.value)}
            className="border border-border rounded-md px-2 py-1 text-xs bg-background"
            title="Desde"
          />
          <input
            type="date"
            value={filtroHasta}
            onChange={e => setFiltroHasta(e.target.value)}
            className="border border-border rounded-md px-2 py-1 text-xs bg-background"
            title="Hasta"
          />
          {(busqueda || filtroDesde || filtroHasta) && (
            <button
              onClick={() => { setBusqueda(''); setFiltroDesde(''); setFiltroHasta('') }}
              className="text-xs text-muted-foreground hover:text-foreground px-2"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              {facturas.length === 0
                ? 'No hay facturas emitidas. Crea la primera con "Nueva factura".'
                : 'No hay facturas que coincidan con los filtros.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Número</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase text-right">Total</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase text-right">Cobrado</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map(f => {
                const cfg = ESTADO_CONFIG[f.estado] ?? ESTADO_CONFIG.pendiente
                const Icon = cfg.icon
                const saldo = f.total - f.montoPagado
                const vencida = !f.esProforma && f.estado !== 'pagada' && f.estado !== 'anulada' && f.fechaVencimiento && new Date(f.fechaVencimiento) < new Date()

                return (
                  <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/contabilidad/facturas/${f.id}`} className="text-sm font-semibold text-foreground hover:text-primary">
                        {f.numero}
                      </Link>
                      {f.ncf && <p className="text-[10px] text-muted-foreground font-mono">NCF: {f.ncf}</p>}
                      {f.esProforma && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">PROFORMA</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(f.fecha)}
                      {vencida && (
                        <span className="ml-1 text-red-600 dark:text-red-400" title={`Vencida desde ${formatDate(f.fechaVencimiento!)}`}>
                          <AlertTriangle className="w-3 h-3 inline" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{f.cliente?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {f.proyecto ? (
                        <Link href={`/proyectos/${f.proyecto.id}`} className="text-muted-foreground hover:text-primary">
                          {f.proyecto.codigo ? <span className="font-mono text-xs">{f.proyecto.codigo}</span> : null}
                          {f.proyecto.codigo ? ' · ' : ''}{f.proyecto.nombre}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">Sin proyecto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums">{formatCurrency(f.total)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      <span className={f.montoPagado >= f.total - 0.01 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                        {formatCurrency(f.montoPagado)}
                      </span>
                      {saldo > 0.01 && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">Saldo: {formatCurrency(saldo)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/contabilidad/facturas/${f.id}`} title="Ver detalle">
                          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                        <Link href={`/contabilidad/facturas/${f.id}/imprimir`} target="_blank" title="Imprimir">
                          <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded transition-colors">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
