'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Trophy, XCircle, TrendingUp, DollarSign, Clock, Users,
  Calendar, Filter, Download, AlertTriangle, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

interface Resumen {
  totalCerradas: number
  ganadas: number
  perdidas: number
  tasaCierre: number
  valorGanado: number
  valorPerdido: number
  activasEnPipeline: number
  cicloPromedioDias: number
}

interface DetalleCerrada {
  id: number
  nombre: string
  etapa: string
  valor: number | null
  moneda: string
  responsable: string | null
  motivoPerdida: string | null
  createdAt: string
  updatedAt: string
  cliente: { id: number; nombre: string }
}

interface Motivo { motivo: string; count: number; valor: number }
interface MesData { mes: string; ganadas: number; perdidas: number; valorGanado: number; valorPerdido: number }
interface ResponsableData { responsable: string; ganadas: number; perdidas: number; valorGanado: number; tasa: number }

interface ReporteData {
  periodo: { desde: string; hasta: string }
  resumen: Resumen
  detalle: DetalleCerrada[]
  motivos: Motivo[]
  meses: MesData[]
  porResponsable: ResponsableData[]
}

const PIE_COLORS = ['#22c55e', '#ef4444']
const MOTIVO_COLORS = ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4']

function formatMes(mes: string) {
  const [y, m] = mes.split('-')
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${meses[parseInt(m) - 1]} ${y.slice(2)}`
}

export function ReportePipelineClient() {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const [desde, setDesde] = useState(sixMonthsAgo.toISOString().slice(0, 10))
  const [hasta, setHasta] = useState(now.toISOString().slice(0, 10))
  const [data, setData] = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroTabla, setFiltroTabla] = useState<'todas' | 'ganadas' | 'perdidas'>('todas')

  async function fetchReport() {
    setLoading(true)
    const res = await fetch(`/api/oportunidades/reporte?desde=${desde}&hasta=${hasta}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchReport() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const detalleFiltrado = useMemo(() => {
    if (!data) return []
    if (filtroTabla === 'ganadas') return data.detalle.filter(d => d.etapa === 'Ganado')
    if (filtroTabla === 'perdidas') return data.detalle.filter(d => d.etapa === 'Perdido')
    return data.detalle
  }, [data, filtroTabla])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) return <p className="text-center text-muted-foreground py-10">Error cargando reporte</p>

  const { resumen, motivos, meses, porResponsable } = data
  const pieData = [
    { name: 'Ganadas', value: resumen.ganadas },
    { name: 'Perdidas', value: resumen.perdidas },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap bg-card border border-border rounded-xl px-4 py-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-medium">Periodo:</span>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="h-8 text-sm border border-border rounded-lg px-2 bg-input text-foreground"
        />
        <span className="text-xs text-muted-foreground">a</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="h-8 text-sm border border-border rounded-lg px-2 bg-input text-foreground"
        />
        <Button size="sm" onClick={fetchReport} className="h-8 text-xs px-3">
          <Calendar className="w-3.5 h-3.5" /> Aplicar
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Total cerradas</span>
          </div>
          <p className="text-2xl font-black text-foreground">{resumen.totalCerradas}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{resumen.activasEnPipeline} activas en pipeline</p>
        </div>

        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 text-green-500" />
            </div>
            <span className="text-xs text-muted-foreground">Tasa de cierre</span>
          </div>
          <p className={`text-2xl font-black ${resumen.tasaCierre >= 50 ? 'text-green-700' : resumen.tasaCierre >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
            {resumen.tasaCierre}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{resumen.ganadas} ganadas · {resumen.perdidas} perdidas</p>
        </div>

        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-green-500" />
            </div>
            <span className="text-xs text-muted-foreground">Valor ganado</span>
          </div>
          <p className="text-2xl font-black text-green-700">{formatCurrency(resumen.valorGanado)}</p>
          {resumen.valorPerdido > 0 && (
            <p className="text-xs text-red-500 mt-0.5">{formatCurrency(resumen.valorPerdido)} perdido</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <span className="text-xs text-muted-foreground">Ciclo promedio</span>
          </div>
          <p className="text-2xl font-black text-foreground">{resumen.cicloPromedioDias}d</p>
          <p className="text-xs text-muted-foreground mt-0.5">desde creación hasta cierre</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart: monthly */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Cierres por mes
          </h3>
          {meses.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={meses}>
                <XAxis dataKey="mes" tickFormatter={formatMes} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip
                  formatter={(value: any, name: any) => [Number(value), name === 'ganadas' ? 'Ganadas' : 'Perdidas']}
                  labelFormatter={(label: any) => formatMes(String(label))}
                />
                <Bar dataKey="ganadas" fill="#22c55e" radius={[3, 3, 0, 0]} name="ganadas" />
                <Bar dataKey="perdidas" fill="#ef4444" radius={[3, 3, 0, 0]} name="perdidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sin datos en este periodo</p>
          )}
        </div>

        {/* Pie chart: motivos de pérdida */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            Motivos de pérdida
          </h3>
          {motivos.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={motivos}
                    dataKey="count"
                    nameKey="motivo"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                  >
                    {motivos.map((_, i) => (
                      <Cell key={i} fill={MOTIVO_COLORS[i % MOTIVO_COLORS.length]} />
                    ))}
                  </Pie>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={(value: any) => [Number(value), 'Casos']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {motivos.map((m, i) => (
                  <div key={m.motivo} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: MOTIVO_COLORS[i % MOTIVO_COLORS.length] }}
                    />
                    <span className="text-xs text-foreground truncate flex-1">{m.motivo}</span>
                    <span className="text-xs font-bold text-muted-foreground">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sin pérdidas en este periodo</p>
          )}
        </div>
      </div>

      {/* By responsable */}
      {porResponsable.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Rendimiento por responsable
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Responsable</th>
                <th className="px-4 py-2.5 text-center">Ganadas</th>
                <th className="px-4 py-2.5 text-center">Perdidas</th>
                <th className="px-4 py-2.5 text-center">Tasa</th>
                <th className="px-4 py-2.5 text-right">Valor ganado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {porResponsable.map((r) => (
                <tr key={r.responsable} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.responsable}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-green-700 font-bold">{r.ganadas}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-red-600 font-bold">{r.perdidas}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-bold ${r.tasa >= 50 ? 'text-green-700' : r.tasa >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.tasa}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">
                    {formatCurrency(r.valorGanado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Detalle de oportunidades cerradas</h3>
          <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
            {(['todas', 'ganadas', 'perdidas'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroTabla(f)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  filtroTabla === f
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {f === 'todas' ? `Todas (${data.detalle.length})` : f === 'ganadas' ? `Ganadas (${resumen.ganadas})` : `Perdidas (${resumen.perdidas})`}
              </button>
            ))}
          </div>
        </div>

        {detalleFiltrado.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No hay oportunidades {filtroTabla !== 'todas' ? filtroTabla : 'cerradas'} en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Oportunidad</th>
                  <th className="px-4 py-2.5 text-left">Cliente</th>
                  <th className="px-4 py-2.5 text-center">Resultado</th>
                  <th className="px-4 py-2.5 text-right">Valor</th>
                  <th className="px-4 py-2.5 text-left">Responsable</th>
                  <th className="px-4 py-2.5 text-left">Fecha cierre</th>
                  <th className="px-4 py-2.5 text-center">Ciclo</th>
                  {filtroTabla !== 'ganadas' && (
                    <th className="px-4 py-2.5 text-left">Motivo pérdida</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detalleFiltrado.map((d) => {
                  const dias = Math.max(Math.floor((new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24)), 0)
                  return (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium text-foreground">{d.nombre}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{d.cliente.nombre}</td>
                      <td className="px-4 py-2.5 text-center">
                        {d.etapa === 'Ganado' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Trophy className="w-3 h-3" /> Ganada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="w-3 h-3" /> Perdida
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums">
                        {d.valor ? formatCurrency(d.valor) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.responsable ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(d.updatedAt).toLocaleDateString('es-DO')}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{dias}d</td>
                      {filtroTabla !== 'ganadas' && (
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                          {d.etapa === 'Perdido' ? (d.motivoPerdida || <span className="italic text-muted-foreground/50">Sin motivo</span>) : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
