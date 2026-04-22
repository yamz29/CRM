'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Filter, Download, Printer, AlertTriangle,
  CheckCircle2, AlertCircle, TrendingUp, Briefcase, DollarSign, Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EstadoProyectoBadge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'

interface Proyecto {
  id: number
  codigo: string | null
  nombre: string
  cliente: string
  clienteId: number
  tipoProyecto: string
  estado: string
  fechaInicio: string | null
  fechaEstimada: string | null
  presupuesto: number
  gastado: number
  pctGasto: number
  avance: number
  salud: 'ok' | 'alerta' | 'critico'
  archivada: boolean
}

interface Props {
  proyectos: Proyecto[]
  desde: string
  hasta: string
  estadosFiltro: string[]
  tiposFiltro: string[]
  incluirArchivados: boolean
  incluirPausados: boolean
  tiposExistentes: string[]
  estadosExistentes: string[]
}

// Colores por estado (hex para recharts)
const ESTADO_COLORS: Record<string, string> = {
  'Prospecto':     '#94a3b8',
  'En Cotización': '#8b5cf6',
  'Adjudicado':    '#eab308',
  'En Ejecución':  '#3b82f6',
  'Terminado':     '#22c55e',
  'Pausado':       '#f97316',
  'Cancelado':     '#ef4444',
  'Finalizado':    '#22c55e',
}

const SALUD_CONFIG = {
  ok:      { label: 'Al día',   color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30',   icon: CheckCircle2 },
  alerta:  { label: 'Alerta',   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30',   icon: AlertCircle },
  critico: { label: 'Crítico',  color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30',       icon: AlertTriangle },
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function ReporteProyectosClient({
  proyectos, desde, hasta, estadosFiltro, tiposFiltro, incluirArchivados, incluirPausados,
  tiposExistentes, estadosExistentes,
}: Props) {
  const router = useRouter()
  const [localDesde, setLocalDesde] = useState(desde)
  const [localHasta, setLocalHasta] = useState(hasta)
  const [localEstados, setLocalEstados] = useState<string[]>(estadosFiltro)
  const [localTipos, setLocalTipos] = useState<string[]>(tiposFiltro)
  const [localArchivados, setLocalArchivados] = useState(incluirArchivados)
  const [localPausados, setLocalPausados] = useState(incluirPausados)
  const [filtroSalud, setFiltroSalud] = useState<'todos' | 'ok' | 'alerta' | 'critico'>('todos')

  function aplicarFiltros() {
    const params = new URLSearchParams()
    if (localDesde) params.set('desde', localDesde)
    if (localHasta) params.set('hasta', localHasta)
    if (localEstados.length > 0) params.set('estados', localEstados.join(','))
    if (localTipos.length > 0) params.set('tipos', localTipos.join(','))
    if (localArchivados) params.set('archivados', '1')
    if (localPausados) params.set('pausados', '1')
    router.push(`/proyectos/reporte?${params.toString()}`)
  }

  // ── Métricas agregadas ──
  const metricas = useMemo(() => {
    const total = proyectos.length
    const totalPresupuesto = proyectos.reduce((s, p) => s + p.presupuesto, 0)
    const totalGastado = proyectos.reduce((s, p) => s + p.gastado, 0)
    const margen = totalPresupuesto - totalGastado
    const pctMargen = totalPresupuesto > 0 ? (margen / totalPresupuesto) * 100 : 0
    // Avance promedio ponderado por presupuesto
    let sumPonderado = 0, sumPesos = 0
    for (const p of proyectos) {
      const peso = p.presupuesto > 0 ? p.presupuesto : 1
      sumPonderado += p.avance * peso
      sumPesos += peso
    }
    const avancePromedio = sumPesos > 0 ? sumPonderado / sumPesos : 0
    return { total, totalPresupuesto, totalGastado, margen, pctMargen, avancePromedio }
  }, [proyectos])

  // ── Agrupación por estado (para pie chart) ──
  const porEstado = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of proyectos) {
      map.set(p.estado, (map.get(p.estado) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([estado, cantidad]) => ({
      estado, cantidad, color: ESTADO_COLORS[estado] ?? '#94a3b8',
    }))
  }, [proyectos])

  // ── Distribución por tipo (para bar horizontal) ──
  const porTipo = useMemo(() => {
    const map = new Map<string, { cantidad: number; monto: number }>()
    for (const p of proyectos) {
      const cur = map.get(p.tipoProyecto) ?? { cantidad: 0, monto: 0 }
      cur.cantidad += 1
      cur.monto += p.presupuesto
      map.set(p.tipoProyecto, cur)
    }
    return Array.from(map.entries())
      .map(([tipo, v]) => ({ tipo, cantidad: v.cantidad, monto: v.monto }))
      .sort((a, b) => b.monto - a.monto)
  }, [proyectos])

  // ── Top 10 proyectos por presupuesto ──
  const top10 = useMemo(() => {
    return [...proyectos]
      .filter(p => p.presupuesto > 0)
      .sort((a, b) => b.presupuesto - a.presupuesto)
      .slice(0, 10)
      .map(p => ({
        nombre: p.nombre.length > 25 ? p.nombre.slice(0, 22) + '…' : p.nombre,
        presupuesto: p.presupuesto,
        gastado: p.gastado,
      }))
  }, [proyectos])

  // ── Scatter: avance vs gasto ──
  const scatterData = useMemo(() => {
    return proyectos
      .filter(p => p.presupuesto > 0)
      .map(p => ({
        x: p.avance,
        y: p.pctGasto,
        nombre: p.nombre,
        salud: p.salud,
        color: p.salud === 'ok' ? '#22c55e' : p.salud === 'alerta' ? '#f59e0b' : '#ef4444',
      }))
  }, [proyectos])

  // ── Distribución de salud ──
  const porSalud = useMemo(() => {
    const ok = proyectos.filter(p => p.salud === 'ok').length
    const alerta = proyectos.filter(p => p.salud === 'alerta').length
    const critico = proyectos.filter(p => p.salud === 'critico').length
    return { ok, alerta, critico }
  }, [proyectos])

  // ── Tabla filtrada por salud ──
  const tablaFiltrada = useMemo(() => {
    if (filtroSalud === 'todos') return proyectos
    return proyectos.filter(p => p.salud === filtroSalud)
  }, [proyectos, filtroSalud])

  function toggleEstado(e: string) {
    setLocalEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
  }
  function toggleTipo(t: string) {
    setLocalTipos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function exportarCSV() {
    const headers = ['Código', 'Proyecto', 'Cliente', 'Tipo', 'Estado', 'Inicio', 'Fin estimado', 'Presupuesto', 'Gastado', '% Gasto', 'Avance %', 'Salud']
    const rows = tablaFiltrada.map(p => [
      p.codigo || '',
      p.nombre,
      p.cliente,
      p.tipoProyecto,
      p.estado,
      fmtFecha(p.fechaInicio),
      fmtFecha(p.fechaEstimada),
      p.presupuesto,
      p.gastado,
      p.pctGasto.toFixed(1),
      p.avance,
      SALUD_CONFIG[p.salud].label,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-proyectos-${desde}_${hasta}.csv`
    a.click()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/proyectos" className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reporte de proyectos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {fmtFecha(desde)} — {fmtFecha(hasta)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportarCSV}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="w-4 h-4" /> Filtros
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Desde</label>
              <input type="date" value={localDesde} onChange={e => setLocalDesde(e.target.value)}
                className="w-full h-8 px-2 text-sm border border-border rounded-lg bg-input" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Hasta</label>
              <input type="date" value={localHasta} onChange={e => setLocalHasta(e.target.value)}
                className="w-full h-8 px-2 text-sm border border-border rounded-lg bg-input" />
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={localArchivados} onChange={e => setLocalArchivados(e.target.checked)} />
                Incluir archivados
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={localPausados} onChange={e => setLocalPausados(e.target.checked)} />
                Incluir pausados
              </label>
            </div>
          </div>

          {estadosExistentes.length > 0 && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Estados</label>
              <div className="flex flex-wrap gap-1">
                {estadosExistentes.map(e => (
                  <button key={e} onClick={() => toggleEstado(e)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      localEstados.includes(e)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tiposExistentes.length > 0 && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Tipos</label>
              <div className="flex flex-wrap gap-1">
                {tiposExistentes.map(t => (
                  <button key={t} onClick={() => toggleTipo(t)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      localTipos.includes(t)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={aplicarFiltros}>Aplicar filtros</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard icon={Briefcase} label="Proyectos" value={String(metricas.total)} color="text-blue-500" bg="bg-blue-500/10" />
        <MetricCard icon={DollarSign} label="Presupuestado" value={formatCurrency(metricas.totalPresupuesto)} color="text-foreground" bg="bg-muted" />
        <MetricCard icon={DollarSign} label="Gastado" value={formatCurrency(metricas.totalGastado)} color="text-amber-600" bg="bg-amber-500/10" />
        <MetricCard
          icon={TrendingUp}
          label="Margen"
          value={`${formatCurrency(metricas.margen)}`}
          subtitle={`${metricas.pctMargen.toFixed(1)}%`}
          color={metricas.margen >= 0 ? 'text-green-600' : 'text-red-600'}
          bg={metricas.margen >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}
        />
        <MetricCard icon={Activity} label="Avance promedio" value={`${metricas.avancePromedio.toFixed(0)}%`} subtitle="(ponderado)" color="text-blue-600" bg="bg-blue-500/10" />
      </div>

      {/* Indicadores de salud */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Estado de los proyectos</p>
          <div className="grid grid-cols-3 gap-3">
            {(['ok', 'alerta', 'critico'] as const).map(s => {
              const Icon = SALUD_CONFIG[s].icon
              const count = porSalud[s]
              const active = filtroSalud === s
              return (
                <button
                  key={s}
                  onClick={() => setFiltroSalud(active ? 'todos' : s)}
                  className={`border-2 rounded-lg p-3 text-left transition-all ${
                    active ? 'border-primary shadow-sm' : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${SALUD_CONFIG[s].color}`} />
                    <span className={`text-xs font-semibold ${SALUD_CONFIG[s].color}`}>{SALUD_CONFIG[s].label}</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">
                    {metricas.total > 0 ? `${((count / metricas.total) * 100).toFixed(0)}%` : '0%'} del total
                  </p>
                </button>
              )
            })}
          </div>
          {filtroSalud !== 'todos' && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando solo proyectos {SALUD_CONFIG[filtroSalud].label.toLowerCase()} en la tabla.
              <button onClick={() => setFiltroSalud('todos')} className="ml-2 text-primary hover:underline">Limpiar filtro</button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gráficos: 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribución por estado (pie) */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-foreground mb-3">Distribución por estado</p>
            {porEstado.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={porEstado}
                    dataKey="cantidad"
                    nameKey="estado"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={(entry: any) => `${entry.estado}: ${entry.cantidad}`}
                  >
                    {porEstado.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Scatter: avance vs % gasto */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-foreground mb-1">Avance físico vs Ejecución presupuestaria</p>
            <p className="text-xs text-muted-foreground mb-2">Cada punto es un proyecto. Lo ideal: cerca de la línea diagonal.</p>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis type="number" dataKey="x" name="Avance" unit="%" domain={[0, 100]} label={{ value: 'Avance físico %', position: 'bottom', offset: 0, fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="Gasto" unit="%" domain={[0, 'dataMax']} label={{ value: '% Gasto', angle: -90, position: 'left', fontSize: 11 }} />
                  <ZAxis range={[60, 200]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload?.[0]) return null
                      const d = payload[0].payload as { nombre: string; x: number; y: number }
                      return (
                        <div className="bg-card border border-border rounded px-2 py-1 text-xs shadow">
                          <p className="font-semibold">{d.nombre}</p>
                          <p>Avance: {d.x}%</p>
                          <p>Gasto: {d.y.toFixed(1)}%</p>
                        </div>
                      )
                    }}
                  />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Scatter data={scatterData}>
                    {scatterData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Top 10 por presupuesto (bar horizontal) */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-foreground mb-3">Top 10 por presupuesto — Presup. vs Gastado</p>
            {top10.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 30)}>
                <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} fontSize={11} />
                  <YAxis type="category" dataKey="nombre" width={150} fontSize={10} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="presupuesto" fill="#3b82f6" name="Presupuesto" />
                  <Bar dataKey="gastado" fill="#f59e0b" name="Gastado" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Distribución por tipo */}
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-foreground mb-3">Monto por tipo de proyecto</p>
            {porTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porTipo} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="tipo" fontSize={11} />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} fontSize={11} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="monto" fill="#8b5cf6" name="Monto" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Detalle ({tablaFiltrada.length} proyecto{tablaFiltrada.length === 1 ? '' : 's'})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Código</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Inicio</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Presup.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Gastado</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">% Gasto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Avance</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Salud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tablaFiltrada.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Sin proyectos para los filtros seleccionados</td></tr>
                ) : tablaFiltrada.map(p => {
                  const SaludIcon = SALUD_CONFIG[p.salud].icon
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2">
                        {p.codigo ? (
                          <span className="font-mono text-xs font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded">{p.codigo}</span>
                        ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Link href={`/proyectos/${p.id}`} className="font-medium text-foreground hover:text-primary">{p.nombre}</Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.cliente}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{p.tipoProyecto}</td>
                      <td className="px-3 py-2"><EstadoProyectoBadge estado={p.estado} /></td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{fmtFecha(p.fechaInicio)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.presupuesto > 0 ? formatCurrency(p.presupuesto) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{p.gastado > 0 ? formatCurrency(p.gastado) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.presupuesto > 0 ? `${p.pctGasto.toFixed(0)}%` : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${p.avance}%`,
                              backgroundColor: p.avance === 100 ? '#22c55e' : p.avance >= 50 ? '#3b82f6' : '#f59e0b',
                            }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums w-9 text-right">{p.avance}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${SALUD_CONFIG[p.salud].bg} ${SALUD_CONFIG[p.salud].color}`}>
                          <SaludIcon className="w-3 h-3" />
                          {SALUD_CONFIG[p.salud].label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ── Helper component ─────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, subtitle, color, bg }: {
  icon: React.ElementType; label: string; value: string; subtitle?: string
  color: string; bg: string
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-2">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-black tabular-nums truncate ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
