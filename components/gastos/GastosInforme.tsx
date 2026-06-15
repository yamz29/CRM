'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChevronRight, Download, Printer, Info } from 'lucide-react'
import {
  DESTINOS, MONEDA_DEFAULT,
  filtrarGastos, gastosEnOtrasMonedas, agruparPorDestino, agruparPorMes, agruparPorProyecto,
  calcularKpis, rangoPeriodoAnterior, presetRango, formatMonto,
  type GastoInput, type PresetRango,
} from '@/lib/gastos-informe'

interface Gasto extends GastoInput {
  id: number
  fecha: string
  monto: number
  moneda: string
  estado: string
  destinoTipo: string
  proyectoId: number | null
  proyecto: { id: number; nombre: string } | null
  partida: { id: number; descripcion: string; codigo: string | null } | null
}

interface Props {
  gastos: Gasto[]
  proyectos: { id: number; nombre: string }[]
}

const PRESETS: { key: PresetRango; label: string }[] = [
  { key: 'este-mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
  { key: 'este-anio', label: 'Este año' },
  { key: 'todo', label: 'Todo' },
]

export function GastosInforme({ gastos, proyectos }: Props) {
  const [preset, setPreset] = useState<PresetRango>('este-anio')
  const inicial = presetRango('este-anio')
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [moneda, setMoneda] = useState(MONEDA_DEFAULT)
  const [destino, setDestino] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [verTodosProyectos, setVerTodosProyectos] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)

  function aplicarPreset(p: PresetRango) {
    setPreset(p)
    if (p !== 'personalizado') {
      const r = presetRango(p)
      setDesde(r.desde); setHasta(r.hasta)
    }
  }

  const monedasDisponibles = useMemo(
    () => [...new Set(gastos.filter(g => g.estado !== 'Anulado').map(g => g.moneda))].sort(),
    [gastos],
  )

  const filtro = { moneda, desde, hasta, destino: destino || null, proyectoId: proyectoId ? Number(proyectoId) : null }

  const filtrados = useMemo(() => filtrarGastos(gastos, filtro), [gastos, moneda, desde, hasta, destino, proyectoId])

  const kpis = useMemo(() => {
    const prev = rangoPeriodoAnterior(desde, hasta)
    const anteriores = filtrarGastos(gastos, { ...filtro, desde: prev.desde, hasta: prev.hasta })
    return calcularKpis(filtrados, anteriores)
  }, [filtrados, gastos, desde, hasta, moneda, destino, proyectoId])

  const porDestino = useMemo(() => agruparPorDestino(filtrados), [filtrados])
  const porMes = useMemo(() => agruparPorMes(filtrados), [filtrados])
  const porProyecto = useMemo(() => agruparPorProyecto(filtrados), [filtrados])
  const otrasMonedas = useMemo(() => gastosEnOtrasMonedas(gastos, filtro), [gastos, moneda, desde, hasta])

  const proyectosVisibles = verTodosProyectos ? porProyecto : porProyecto.slice(0, 10)

  const queryExport = new URLSearchParams({
    desde, hasta, moneda,
    ...(destino ? { destino } : {}),
    ...(proyectoId ? { proyectoId } : {}),
  }).toString()

  const chartData = porMes.map(m => ({
    name: m.label,
    ...Object.fromEntries(DESTINOS.map(d => [d.label, m.porDestino[d.key] ?? 0])),
  }))

  return (
    <div className="space-y-5">
      {/* Barra de filtros */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => aplicarPreset(p.key)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                preset === p.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}>{p.label}</button>
          ))}
        </div>
        <input type="date" value={desde} onChange={e => { setPreset('personalizado'); setDesde(e.target.value) }}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground" />
        <span className="text-xs text-muted-foreground">a</span>
        <input type="date" value={hasta} onChange={e => { setPreset('personalizado'); setHasta(e.target.value) }}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground" />
        <select value={moneda} onChange={e => setMoneda(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          {(monedasDisponibles.length ? monedasDisponibles : [MONEDA_DEFAULT]).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={destino} onChange={e => setDestino(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los destinos</option>
          {DESTINOS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <a href={`/api/export/gastos/informe?${queryExport}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <a href={`/gastos/informe/imprimir?${queryExport}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            <Printer className="w-3.5 h-3.5" /> PDF
          </a>
        </div>
      </div>

      {otrasMonedas > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Hay {otrasMonedas} gasto(s) en otra moneda no incluidos. Cambia la moneda para verlos.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total del periodo" valor={formatMonto(kpis.total, moneda)} />
        <KpiCard label="# de gastos" valor={String(kpis.count)} />
        <KpiCard label="Ticket promedio" valor={formatMonto(kpis.promedio, moneda)} />
        <KpiCard label="vs periodo anterior"
          valor={kpis.deltaPct === null ? '—' : `${kpis.deltaPct >= 0 ? '+' : ''}${(kpis.deltaPct * 100).toFixed(1)}%`}
          tono={kpis.deltaPct === null ? 'neutro' : kpis.deltaPct > 0 ? 'malo' : 'bueno'} />
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-16 text-center text-muted-foreground text-sm">
          No hay gastos en este periodo con los filtros seleccionados.
        </div>
      ) : (
        <>
          {/* Por destino */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por destino</h3>
            <div className="space-y-2">
              {porDestino.map(d => (
                <div key={d.destino} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground shrink-0">{d.label}</span>
                  <div className="flex-1 bg-muted/40 rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.pct * 100).toFixed(1)}%`, backgroundColor: DESTINOS.find(x => x.key === d.destino)?.color ?? '#64748b' }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-32 text-right tabular-nums">{formatMonto(d.total, moneda)}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{(d.pct * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Por mes */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por mes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70}
                    tickFormatter={(v: number) => v.toLocaleString('en-US', { notation: 'compact' })} />
                  <Tooltip formatter={(v) => formatMonto(Number(v), moneda)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {DESTINOS.map(d => <Bar key={d.key} dataKey={d.label} stackId="a" fill={d.color} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Por proyecto */}
          {porProyecto.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <h3 className="text-sm font-semibold text-foreground p-4 pb-2">Por proyecto</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-y border-border text-xs font-semibold text-muted-foreground uppercase">
                    <th className="px-4 py-2 text-left">Proyecto</th>
                    <th className="px-4 py-2 text-center">Gastos</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {proyectosVisibles.map(p => {
                    const key = p.proyectoId != null ? String(p.proyectoId) : 'sin'
                    const abierto = expandido === key
                    return (
                      <Fragment key={key}>
                        <tr className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandido(abierto ? null : key)}>
                          <td className="px-4 py-2 font-medium text-foreground flex items-center gap-1">
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                            {p.nombre}
                          </td>
                          <td className="px-4 py-2 text-center text-muted-foreground">{p.count}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMonto(p.total, moneda)}</td>
                        </tr>
                        {abierto && p.partidas.map((pt, i) => (
                          <tr key={`${key}-${i}`} className="bg-muted/20 text-xs">
                            <td className="px-4 py-1.5 pl-10 text-muted-foreground">{pt.codigo ? `${pt.codigo} · ` : ''}{pt.descripcion}</td>
                            <td></td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatMonto(pt.total, moneda)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              {porProyecto.length > 10 && (
                <button onClick={() => setVerTodosProyectos(!verTodosProyectos)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors">
                  {verTodosProyectos ? 'Ver menos' : `Ver todos (${porProyecto.length})`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ label, valor, tono = 'neutro' }: { label: string; valor: string; tono?: 'neutro' | 'bueno' | 'malo' }) {
  const color = tono === 'bueno' ? 'text-green-600 dark:text-green-400'
    : tono === 'malo' ? 'text-red-600 dark:text-red-400' : 'text-foreground'
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{valor}</p>
    </div>
  )
}
