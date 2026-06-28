'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Info, TrendingUp, TrendingDown, Loader2, Download, Printer, ChevronRight } from 'lucide-react'
import {
  DESTINOS, MONEDA_DEFAULT, presetRango, formatMonto, type PresetRango,
} from '@/lib/gastos-informe'
import type { InformeEconomicoData } from '@/lib/informe-economico'

const PRESETS: { key: PresetRango; label: string }[] = [
  { key: 'este-mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
  { key: 'este-anio', label: 'Este año' },
  { key: 'todo', label: 'Todo' },
]

function color(destino: string): string {
  return DESTINOS.find(d => d.key === destino)?.color ?? '#64748b'
}

function pct(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`
}

export function InformeEconomico() {
  const [preset, setPreset] = useState<PresetRango>('este-mes')
  const inicial = presetRango('este-mes')
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [data, setData] = useState<InformeEconomicoData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const queryExport = new URLSearchParams({ desde, hasta }).toString()

  function aplicarPreset(p: PresetRango) {
    setPreset(p)
    if (p !== 'personalizado') {
      const r = presetRango(p)
      setDesde(r.desde); setHasta(r.hasta)
    }
  }

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    const qs = new URLSearchParams({ desde, hasta }).toString()
    fetch(`/api/contabilidad/informe-economico?${qs}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Error al cargar el informe')
        return r.json() as Promise<InformeEconomicoData>
      })
      .then(d => { if (!cancelado) setData(d) })
      .catch(e => { if (!cancelado) setError(e.message) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [desde, hasta])

  const chartData = useMemo(
    () => (data?.porMes ?? []).map(m => ({
      name: m.label, Ingresos: m.ingresos, Gastos: m.gastos, Resultado: m.resultado,
    })),
    [data],
  )

  const deltaResultado = useMemo(() => {
    if (!data) return null
    const ant = data.kpisAnterior.resultado
    if (ant === 0) return null
    return (data.kpis.resultado - ant) / Math.abs(ant)
  }, [data])

  return (
    <div className="space-y-5">
      {/* Filtros */}
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
        {cargando && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex gap-2">
          <a href={`/api/export/contabilidad/informe-economico?${queryExport}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <a href={`/contabilidad/informe-economico/imprimir?${queryExport}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            <Printer className="w-3.5 h-3.5" /> PDF
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-card rounded-xl border border-red-200 dark:border-red-800 py-10 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {data && !error && (
        <>
          {data.otrasMonedas.count > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              {data.otrasMonedas.count} gasto(s) en otra moneda no incluidos (≈ {formatMonto(data.otrasMonedas.total, '')} sin convertir). El informe es en {MONEDA_DEFAULT}.
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Ingresos (cobrado)" valor={formatMonto(data.kpis.ingresos, MONEDA_DEFAULT)} tono="bueno" />
            <KpiCard label="Gastos" valor={formatMonto(data.kpis.gastos, MONEDA_DEFAULT)} tono="malo" />
            <KpiCard
              label="Resultado"
              valor={formatMonto(data.kpis.resultado, MONEDA_DEFAULT)}
              tono={data.kpis.resultado >= 0 ? 'bueno' : 'malo'}
              icono={data.kpis.resultado >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            />
            <KpiCard
              label="Margen"
              valor={pct(data.kpis.margen)}
              sub={deltaResultado === null ? 'vs período anterior: —' : `Resultado vs anterior: ${deltaResultado >= 0 ? '+' : ''}${(deltaResultado * 100).toFixed(0)}%`}
              tono={data.kpis.margen === null ? 'neutro' : data.kpis.margen >= 0 ? 'bueno' : 'malo'}
            />
          </div>

          {data.kpis.ingresos === 0 && data.kpis.gastos === 0 ? (
            <div className="bg-card rounded-xl border border-border py-16 text-center text-muted-foreground text-sm">
              No hay ingresos ni gastos en este período.
            </div>
          ) : (
            <>
              {/* Por renglón */}
              {data.porRenglon.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Gasto por renglón</h3>
                  <div className="space-y-2">
                    {data.porRenglon.map(r => (
                      <div key={r.destino} className="flex items-center gap-3">
                        <span className="text-xs w-24 text-muted-foreground shrink-0">{r.label}</span>
                        <div className="flex-1 bg-muted/40 rounded-full h-5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(r.pct * 100).toFixed(1)}%`, backgroundColor: color(r.destino) }} />
                        </div>
                        <span className="text-xs font-medium text-foreground w-32 text-right tabular-nums">{formatMonto(r.total, MONEDA_DEFAULT)}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{(r.pct * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rentabilidad por proyecto */}
              {data.porProyecto.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <h3 className="text-sm font-semibold text-foreground p-4 pb-2">Rentabilidad por proyecto</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-y border-border text-xs font-semibold text-muted-foreground uppercase">
                          <th className="px-4 py-2 text-left">Proyecto</th>
                          <th className="px-4 py-2 text-right">Ingresos</th>
                          <th className="px-4 py-2 text-right">Gastos</th>
                          <th className="px-4 py-2 text-right">Resultado</th>
                          <th className="px-4 py-2 text-right">Margen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.porProyecto.map(p => {
                          const key = p.proyectoId != null ? String(p.proyectoId) : 'sin'
                          const tienePartidas = p.partidas.length > 0
                          const abierto = expandido === key
                          return (
                            <Fragment key={key}>
                              <tr
                                className={`hover:bg-muted/30 ${tienePartidas ? 'cursor-pointer' : ''}`}
                                onClick={() => tienePartidas && setExpandido(abierto ? null : key)}
                              >
                                <td className="px-4 py-2 font-medium text-foreground">
                                  <span className="flex items-center gap-1">
                                    {tienePartidas
                                      ? <ChevronRight className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                                      : <span className="w-3.5" />}
                                    {p.nombre}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMonto(p.ingresos, MONEDA_DEFAULT)}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMonto(p.gastos, MONEDA_DEFAULT)}</td>
                                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${p.resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {formatMonto(p.resultado, MONEDA_DEFAULT)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{pct(p.margen)}</td>
                              </tr>
                              {abierto && p.partidas.map(pt => (
                                <tr key={`${key}-${pt.partidaId ?? 'sin'}`} className="bg-muted/20 text-xs">
                                  <td className="px-4 py-1.5 pl-11 text-muted-foreground">{pt.codigo ? `${pt.codigo} · ` : ''}{pt.descripcion}</td>
                                  <td></td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatMonto(pt.total, MONEDA_DEFAULT)}</td>
                                  <td colSpan={2}></td>
                                </tr>
                              ))}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Estructura / Overhead */}
              {data.overhead.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <h3 className="text-sm font-semibold text-foreground p-4 pb-1">Estructura / Overhead</h3>
                  <p className="text-xs text-muted-foreground px-4 pb-2">Ingresos y gastos que no pertenecen a un proyecto (Oficina, Taller, General).</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-y border-border text-xs font-semibold text-muted-foreground uppercase">
                          <th className="px-4 py-2 text-left">Renglón</th>
                          <th className="px-4 py-2 text-right">Ingresos</th>
                          <th className="px-4 py-2 text-right">Gastos</th>
                          <th className="px-4 py-2 text-right">Resultado</th>
                          <th className="px-4 py-2 text-right">Margen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.overhead.map(o => {
                          const key = `oh-${o.destino}`
                          const tieneCats = o.categorias.length > 0
                          const abierto = expandido === key
                          return (
                            <Fragment key={key}>
                              <tr
                                className={`hover:bg-muted/30 ${tieneCats ? 'cursor-pointer' : ''}`}
                                onClick={() => tieneCats && setExpandido(abierto ? null : key)}
                              >
                                <td className="px-4 py-2 font-medium text-foreground">
                                  <span className="flex items-center gap-1.5">
                                    {tieneCats
                                      ? <ChevronRight className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                                      : <span className="w-3.5" />}
                                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color(o.destino) }} />
                                    {o.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMonto(o.ingresos, MONEDA_DEFAULT)}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMonto(o.gastos, MONEDA_DEFAULT)}</td>
                                <td className={`px-4 py-2 text-right tabular-nums font-semibold ${o.resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {formatMonto(o.resultado, MONEDA_DEFAULT)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{pct(o.margen)}</td>
                              </tr>
                              {abierto && o.categorias.map((c, i) => (
                                <tr key={`${key}-${i}`} className="bg-muted/20 text-xs">
                                  <td className="px-4 py-1.5 pl-11 text-muted-foreground">{c.categoria}</td>
                                  <td></td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatMonto(c.total, MONEDA_DEFAULT)}</td>
                                  <td colSpan={2}></td>
                                </tr>
                              ))}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Evolución mensual */}
              {chartData.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Evolución mensual</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={70}
                          tickFormatter={(v: number) => v.toLocaleString('en-US', { notation: 'compact' })} />
                        <Tooltip formatter={(v) => formatMonto(Number(v), MONEDA_DEFAULT)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Ingresos" fill="#22c55e" />
                        <Bar dataKey="Gastos" fill="#ef4444" />
                        <Line type="monotone" dataKey="Resultado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ label, valor, sub, tono = 'neutro', icono }: {
  label: string; valor: string; sub?: string; tono?: 'neutro' | 'bueno' | 'malo'; icono?: React.ReactNode
}) {
  const color = tono === 'bueno' ? 'text-green-600 dark:text-green-400'
    : tono === 'malo' ? 'text-red-600 dark:text-red-400' : 'text-foreground'
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 flex items-center gap-1.5 ${color}`}>
        {icono}{valor}
      </p>
      {sub && <p className="text-2xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}
