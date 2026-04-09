'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, Plus, Camera, Loader2, AlertTriangle, CheckCircle,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

interface Snapshot {
  id: number
  fecha: string
  avanceFisico: number
  presupuestoBase: number
  valorPlanificado: number
  valorGanado: number
  costoReal: number
  spi: number | null
  cpi: number | null
  eac: number | null
  notas: string | null
}

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return v.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtFull(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function IndexBadge({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const good = value >= 1
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
      good ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
           : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    }`}>
      {good ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {label}: {value.toFixed(3)}
      {good ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
    </div>
  )
}

export function EVMTab({ proyectoId }: { proyectoId: number }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/evm`)
      if (res.ok) setSnapshots(await res.json())
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleCapture() {
    setCapturing(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/evm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _auto: true }),
      })
      if (res.ok) await fetchData()
    } finally {
      setCapturing(false)
    }
  }

  const ultimo = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null

  const chartData = snapshots.map((s) => ({
    fecha: new Date(s.fecha).toLocaleDateString('es-DO', { month: 'short', day: 'numeric' }),
    PV: Math.round(s.valorPlanificado),
    EV: Math.round(s.valorGanado),
    AC: Math.round(s.costoReal),
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando EVM...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + capture button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Earned Value Management (Curva S)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seguimiento de valor planificado, ganado y costo real del proyecto
          </p>
        </div>
        <Button onClick={handleCapture} size="sm" disabled={capturing}>
          <Camera className="w-3.5 h-3.5" />
          {capturing ? 'Capturando...' : 'Capturar snapshot'}
        </Button>
      </div>

      {/* Indices actuales */}
      {ultimo && (
        <div className="flex flex-wrap gap-3">
          <IndexBadge label="SPI" value={ultimo.spi} />
          <IndexBadge label="CPI" value={ultimo.cpi} />
          {ultimo.eac !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              EAC: {fmtFull(ultimo.eac)}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            Avance: {ultimo.avanceFisico}%
          </div>
        </div>
      )}

      {/* KPI cards */}
      {ultimo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border rounded-xl p-3 bg-card">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BAC (Presupuesto)</p>
            <p className="text-lg font-bold text-foreground">{fmtFull(ultimo.presupuestoBase)}</p>
          </div>
          <div className="border border-border rounded-xl p-3 bg-card">
            <p className="text-[10px] uppercase tracking-wider text-blue-500">PV (Planificado)</p>
            <p className="text-lg font-bold text-blue-600">{fmtFull(ultimo.valorPlanificado)}</p>
          </div>
          <div className="border border-border rounded-xl p-3 bg-card">
            <p className="text-[10px] uppercase tracking-wider text-green-500">EV (Valor Ganado)</p>
            <p className="text-lg font-bold text-green-600">{fmtFull(ultimo.valorGanado)}</p>
          </div>
          <div className="border border-border rounded-xl p-3 bg-card">
            <p className="text-[10px] uppercase tracking-wider text-red-500">AC (Costo Real)</p>
            <p className="text-lg font-bold text-red-600">{fmtFull(ultimo.costoReal)}</p>
          </div>
        </div>
      )}

      {/* S-Curve chart */}
      {chartData.length >= 2 ? (
        <div className="border border-border rounded-xl p-4 bg-card">
          <h4 className="text-xs font-semibold text-muted-foreground mb-4">Curva S — Evolución del proyecto</h4>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [fmtFull(Number(value)), String(name)]}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="PV" name="Valor Planificado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="EV" name="Valor Ganado" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="AC" name="Costo Real" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : chartData.length === 1 ? (
        <div className="border border-dashed border-border rounded-xl py-8 text-center">
          <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">1 snapshot registrado. Captura al menos 2 para ver la curva S.</p>
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Sin datos EVM</p>
          <p className="text-xs text-muted-foreground mt-1">
            Captura snapshots periódicos para monitorear la salud financiera del proyecto
          </p>
        </div>
      )}

      {/* Snapshot history table */}
      {snapshots.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30">
            <h4 className="text-xs font-semibold text-muted-foreground">Historial de snapshots ({snapshots.length})</h4>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Avance</th>
                <th className="px-3 py-2 text-right font-semibold text-blue-500">PV</th>
                <th className="px-3 py-2 text-right font-semibold text-green-500">EV</th>
                <th className="px-3 py-2 text-right font-semibold text-red-500">AC</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">SPI</th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">CPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...snapshots].reverse().map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-foreground">{new Date(s.fecha).toLocaleDateString('es-DO')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.avanceFisico}%</td>
                  <td className="px-3 py-2 text-right tabular-nums text-blue-600">{fmt(s.valorPlanificado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-600">{fmt(s.valorGanado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{fmt(s.costoReal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.spi !== null ? (
                      <span className={s.spi >= 1 ? 'text-green-600' : 'text-red-600'}>{s.spi.toFixed(3)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.cpi !== null ? (
                      <span className={s.cpi >= 1 ? 'text-green-600' : 'text-red-600'}>{s.cpi.toFixed(3)}</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
