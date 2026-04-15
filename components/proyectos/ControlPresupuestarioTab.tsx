'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { PoblarPresupuestoModal } from './PoblarPresupuestoModal'
import { FusionarPorCodigoModal } from './FusionarPorCodigoModal'
import { FusionarManualModal } from './FusionarManualModal'
import {
  BarChart2, FileDown, Search, ChevronDown, ChevronRight,
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Minus,
  RefreshCw, Printer, Combine, X,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────

interface PartidaData {
  id: number
  codigo: string | null
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotalPresupuestado: number
  gastoReal: number
  diferencia: number
  pctConsumido: number
  estado: 'sin_gasto' | 'normal' | 'alerta' | 'excedido'
}

interface CapituloData {
  id: number
  nombre: string
  orden: number
  partidas: PartidaData[]
  totalPresupuestado: number
  totalGastoReal: number
  diferencia: number
  pctConsumido: number
}

interface Resumen {
  totalPresupuestado: number
  totalGastoReal: number
  diferencia: number
  pctConsumido: number
  gastosNoClasificados: number
  totalGastos: number
  cantidadCapitulos: number
  cantidadPartidas: number
}

// ── Helpers ────────────────────────────────────────────────────────────

function BarPct({ pct, estado }: { pct: number; estado: string }) {
  const color = estado === 'excedido' ? 'bg-red-500'
    : estado === 'alerta' ? 'bg-amber-400'
    : estado === 'normal' ? 'bg-green-500'
    : 'bg-muted'
  const width = Math.min(pct, 100)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-xs font-semibold w-10 text-right tabular-nums ${
        estado === 'excedido' ? 'text-red-600'
          : estado === 'alerta' ? 'text-amber-600'
          : estado === 'normal' ? 'text-green-700'
          : 'text-muted-foreground'
      }`}>
        {pct >= 999 ? '∞%' : `${pct.toFixed(0)}%`}
      </span>
    </div>
  )
}

function Semaforo({ estado }: { estado: string }) {
  const cfg = estado === 'excedido'
    ? { bg: 'bg-red-500', ring: 'ring-red-200', title: 'Excedido' }
    : estado === 'alerta'
    ? { bg: 'bg-amber-400', ring: 'ring-amber-200', title: 'En alerta' }
    : estado === 'normal'
    ? { bg: 'bg-green-500', ring: 'ring-green-200', title: 'Normal' }
    : { bg: 'bg-muted', ring: 'ring-muted/40', title: 'Sin gasto' }
  return (
    <span
      title={cfg.title}
      className={`inline-block w-3 h-3 rounded-full ring-2 ${cfg.bg} ${cfg.ring} flex-shrink-0`}
    />
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === 'excedido') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
      <AlertTriangle className="w-3 h-3" /> Excedido
    </span>
  )
  if (estado === 'alerta') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
      <TrendingUp className="w-3 h-3" /> Alerta
    </span>
  )
  if (estado === 'normal') return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
      <CheckCircle className="w-3 h-3" /> Normal
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
      <Minus className="w-3 h-3" /> Sin gasto
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function ControlPresupuestarioTab({
  proyectoId,
  presupuestoBaseId,
}: {
  proyectoId: number
  presupuestoBaseId: number | null
}) {
  const [data, setData] = useState<{ capitulos: CapituloData[]; resumen: Resumen } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPoblar, setShowPoblar] = useState(false)
  const [showFusionarAuto, setShowFusionarAuto] = useState(false)
  const [showFusionarManual, setShowFusionarManual] = useState(false)
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [vista, setVista] = useState<'capitulos' | 'partidas'>('capitulos')

  function load() {
    setLoading(true)
    fetch(`/api/proyectos/${proyectoId}/control-presupuestario`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        // Expand all chapters by default
        if (d.capitulos) {
          setExpanded(new Set(d.capitulos.map((c: CapituloData) => c.id)))
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [proyectoId])

  const filteredCapitulos = useMemo(() => {
    if (!data) return []
    const q = busqueda.toLowerCase()
    return data.capitulos.map(cap => ({
      ...cap,
      partidas: cap.partidas.filter(p => {
        const matchText = !q || p.descripcion.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q)
        const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
        return matchText && matchEstado
      }),
    })).filter(cap => cap.partidas.length > 0)
  }, [data, busqueda, filtroEstado])

  const allPartidas = useMemo(() => filteredCapitulos.flatMap(c => c.partidas), [filteredCapitulos])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Cargando datos de control...
      </div>
    )
  }

  // No structure loaded yet
  if (!data || data.capitulos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <BarChart2 className="w-14 h-14 text-muted-foreground/70" />
        <div>
          <h3 className="text-foreground font-semibold text-base">Sin estructura presupuestaria</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-sm">
            Importa las partidas desde un presupuesto aprobado para activar el control presupuestario.
          </p>
        </div>
        <Button onClick={() => setShowPoblar(true)}>
          <FileDown className="w-4 h-4" /> Poblar desde presupuesto
        </Button>
        {showPoblar && (
          <PoblarPresupuestoModal
            proyectoId={proyectoId}
            presupuestoBaseId={presupuestoBaseId}
            onClose={() => setShowPoblar(false)}
            onSuccess={load}
          />
        )}
      </div>
    )
  }

  const { resumen } = data

  return (
    <div className="space-y-5">
      {/* ── Resumen ejecutivo ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Presupuestado', value: formatCurrency(resumen.totalPresupuestado),
            icon: <FileDown className="w-4 h-4 text-blue-500" />, sub: `${resumen.cantidadPartidas} partidas`,
          },
          {
            label: 'Gasto real', value: formatCurrency(resumen.totalGastoReal),
            icon: <TrendingDown className="w-4 h-4 text-red-500" />, sub: `${resumen.totalGastos} registros`,
          },
          {
            label: resumen.diferencia >= 0 ? 'Disponible' : 'Sobregirado',
            value: (resumen.diferencia < 0 ? '−' : '') + formatCurrency(Math.abs(resumen.diferencia)),
            icon: resumen.diferencia >= 0
              ? <TrendingUp className="w-4 h-4 text-green-500" />
              : <AlertTriangle className="w-4 h-4 text-red-500" />,
            sub: `${resumen.pctConsumido.toFixed(1)}% ejecutado`,
            color: resumen.diferencia < 0 ? 'text-red-600' : 'text-green-700',
          },
          {
            label: 'No clasificados', value: formatCurrency(resumen.gastosNoClasificados),
            icon: <Minus className="w-4 h-4 text-muted-foreground" />, sub: 'gastos sin partida',
          },
        ].map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1.5">{card.icon}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={`text-lg font-black ${card.color ?? 'text-foreground'}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Barra de progreso global ── */}
      <div className="bg-card border border-border rounded-xl px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground">Ejecución presupuestaria global</span>
          <span className={`text-sm font-bold ${
            resumen.pctConsumido >= 100 ? 'text-red-600' : resumen.pctConsumido >= 80 ? 'text-amber-600' : 'text-green-700'
          }`}>{resumen.pctConsumido.toFixed(1)}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              resumen.pctConsumido >= 100 ? 'bg-red-500' : resumen.pctConsumido >= 80 ? 'bg-amber-400' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(resumen.pctConsumido, 100)}%` }}
          />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar partida..." className="pl-8 h-8 text-sm" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="h-8 text-sm border border-border rounded-md px-2 bg-card">
          <option value="todos">Todos</option>
          <option value="excedido">Excedidos</option>
          <option value="alerta">En alerta</option>
          <option value="normal">Normal</option>
          <option value="sin_gasto">Sin gasto</option>
        </select>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['capitulos', 'partidas'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === v ? 'bg-slate-800 text-white' : 'bg-card text-muted-foreground hover:bg-muted'
              }`}>
              {v === 'capitulos' ? 'Por capítulo' : 'Todas las partidas'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          {modoSeleccion ? (
            <>
              <span className="self-center text-xs text-muted-foreground">
                {seleccionadas.size} seleccionada{seleccionadas.size === 1 ? '' : 's'}
              </span>
              <Button
                size="sm"
                onClick={() => setShowFusionarManual(true)}
                disabled={seleccionadas.size < 2}
              >
                <Combine className="w-3.5 h-3.5" /> Fusionar selección
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setModoSeleccion(false); setSeleccionadas(new Set()) }}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowFusionarAuto(true)}>
                <Combine className="w-3.5 h-3.5" /> Fusionar por código
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setModoSeleccion(true)}>
                <Combine className="w-3.5 h-3.5" /> Fusionar manual
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowPoblar(true)}>
                <FileDown className="w-3.5 h-3.5" /> Reimportar
              </Button>
              <Link href={`/proyectos/${proyectoId}/reporte`} target="_blank">
                <Button variant="secondary" size="sm">
                  <Printer className="w-3.5 h-3.5" /> Imprimir reporte
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Vista por capítulos ── */}
      {vista === 'capitulos' && (
        <div className="space-y-3">
          {filteredCapitulos.map(cap => {
            const isOpen = expanded.has(cap.id)
            return (
              <div key={cap.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Capítulo header */}
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  onClick={() => setExpanded(prev => {
                    const n = new Set(prev)
                    isOpen ? n.delete(cap.id) : n.add(cap.id)
                    return n
                  })}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                  <span className="font-semibold text-sm flex-1 text-left">{cap.nombre}</span>
                  <div className="flex items-center gap-6 text-xs">
                    <div className="text-right">
                      <div className="text-muted-foreground">Presupuesto</div>
                      <div className="font-bold">{formatCurrency(cap.totalPresupuestado)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Gasto real</div>
                      <div className="font-bold">{formatCurrency(cap.totalGastoReal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-muted-foreground">Diferencia</div>
                      <div className={`font-bold ${cap.diferencia < 0 ? 'text-red-300' : 'text-green-300'}`}>
                        {cap.diferencia < 0 && '−'}{formatCurrency(Math.abs(cap.diferencia))}
                      </div>
                    </div>
                    <div className="w-24">
                      <BarPct pct={cap.pctConsumido}
                        estado={cap.pctConsumido >= 100 ? 'excedido' : cap.pctConsumido >= 80 ? 'alerta' : cap.totalGastoReal > 0 ? 'normal' : 'sin_gasto'} />
                    </div>
                  </div>
                </button>

                {/* Partidas */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="px-3 py-2 w-8" />
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Descripción</th>
                          <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Und</th>
                          <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Presupuestado</th>
                          <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Gasto real</th>
                          <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wide">Diferencia</th>
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide w-32">Avance</th>
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cap.partidas.map(p => (
                          <tr key={p.id} className={`hover:bg-muted/70 ${seleccionadas.has(p.id) ? 'bg-primary/5' : p.estado === 'excedido' ? 'bg-red-50/30' : ''}`}>
                            <td className="px-3 py-2.5 text-center">
                              {modoSeleccion ? (
                                <input
                                  type="checkbox"
                                  checked={seleccionadas.has(p.id)}
                                  onChange={() => {
                                    setSeleccionadas(prev => {
                                      const n = new Set(prev)
                                      if (n.has(p.id)) n.delete(p.id)
                                      else n.add(p.id)
                                      return n
                                    })
                                  }}
                                />
                              ) : (
                                <Semaforo estado={p.estado} />
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground font-mono">{p.codigo ?? '—'}</td>
                            <td className="px-4 py-2.5 text-foreground font-medium max-w-xs">{p.descripcion}</td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{p.unidad}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">
                              {formatCurrency(p.subtotalPresupuestado)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                              {formatCurrency(p.gastoReal)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${p.diferencia < 0 ? 'text-red-600' : 'text-green-700'}`}>
                              {p.diferencia < 0 && '−'}{formatCurrency(Math.abs(p.diferencia))}
                            </td>
                            <td className="px-4 py-2.5 min-w-[120px]">
                              <BarPct pct={p.pctConsumido} estado={p.estado} />
                            </td>
                            <td className="px-4 py-2.5">
                              <EstadoBadge estado={p.estado} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Vista todas las partidas ── */}
      {vista === 'partidas' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="px-3 py-2.5 w-8" />
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide">Capítulo</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide">Código</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide">Descripción</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground uppercase tracking-wide">Presupuestado</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground uppercase tracking-wide">Gasto real</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground uppercase tracking-wide">Diferencia</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide w-32">Avance</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allPartidas.map(p => {
                  const cap = filteredCapitulos.find(c => c.partidas.some(pp => pp.id === p.id))
                  return (
                    <tr key={p.id} className={`hover:bg-muted/70 ${seleccionadas.has(p.id) ? 'bg-primary/5' : p.estado === 'excedido' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2.5 text-center">
                        {modoSeleccion ? (
                          <input
                            type="checkbox"
                            checked={seleccionadas.has(p.id)}
                            onChange={() => {
                              setSeleccionadas(prev => {
                                const n = new Set(prev)
                                if (n.has(p.id)) n.delete(p.id)
                                else n.add(p.id)
                                return n
                              })
                            }}
                          />
                        ) : (
                          <Semaforo estado={p.estado} />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[120px] truncate">{cap?.nombre ?? '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground font-mono">{p.codigo ?? '—'}</td>
                      <td className="px-4 py-2.5 text-foreground font-medium max-w-xs">{p.descripcion}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">{formatCurrency(p.subtotalPresupuestado)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{formatCurrency(p.gastoReal)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${p.diferencia < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {p.diferencia < 0 && '−'}{formatCurrency(Math.abs(p.diferencia))}
                      </td>
                      <td className="px-4 py-2.5 min-w-[120px]"><BarPct pct={p.pctConsumido} estado={p.estado} /></td>
                      <td className="px-4 py-2.5"><EstadoBadge estado={p.estado} /></td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold">TOTAL GENERAL</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{formatCurrency(resumen.totalPresupuestado)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{formatCurrency(resumen.totalGastoReal)}</td>
                  <td className={`px-4 py-3 text-right font-bold tabular-nums ${resumen.diferencia < 0 ? 'text-red-300' : 'text-green-300'}`}>
                    {resumen.diferencia < 0 && '−'}{formatCurrency(Math.abs(resumen.diferencia))}
                  </td>
                  <td className="px-4 py-3"><BarPct pct={resumen.pctConsumido} estado={resumen.pctConsumido >= 100 ? 'excedido' : resumen.pctConsumido >= 80 ? 'alerta' : 'normal'} /></td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showPoblar && (
        <PoblarPresupuestoModal
          proyectoId={proyectoId}
          presupuestoBaseId={presupuestoBaseId}
          onClose={() => setShowPoblar(false)}
          onSuccess={load}
        />
      )}

      {showFusionarAuto && (
        <FusionarPorCodigoModal
          proyectoId={proyectoId}
          onClose={() => setShowFusionarAuto(false)}
          onSuccess={load}
        />
      )}

      {showFusionarManual && seleccionadas.size >= 2 && (
        <FusionarManualModal
          proyectoId={proyectoId}
          partidas={allPartidas.filter(p => seleccionadas.has(p.id)).map(p => ({
            id: p.id,
            codigo: p.codigo,
            descripcion: p.descripcion,
            subtotalPresupuestado: p.subtotalPresupuestado,
            cantidad: p.cantidad,
            unidad: p.unidad,
          }))}
          onClose={() => setShowFusionarManual(false)}
          onSuccess={() => {
            setModoSeleccion(false)
            setSeleccionadas(new Set())
            load()
          }}
        />
      )}
    </div>
  )
}
