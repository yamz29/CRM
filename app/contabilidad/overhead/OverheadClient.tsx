'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Layers, Save, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { montoPorcentaje } from '@/lib/overhead'

export interface ProyectoOverhead {
  proyectoId: number
  nombre: string
  estado: string
  porcentaje: number
  montoAsignado: number
}

export interface OverheadData {
  anio: number
  mes: number
  poolReal: number
  proyectos: ProyectoOverhead[]
  totalAsignadoPct: number
  totalAsignadoMonto: number
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function OverheadClient({ inicial }: { inicial: OverheadData }) {
  const toast = useToast()
  const [anio, setAnio] = useState(inicial.anio)
  const [mes, setMes] = useState(inicial.mes)
  const [poolReal, setPoolReal] = useState(inicial.poolReal)
  // Mapa proyectoId -> porcentaje (como string para el input)
  const [pcts, setPcts] = useState<Record<number, string>>(() =>
    Object.fromEntries(inicial.proyectos.map(p => [p.proyectoId, p.porcentaje ? String(p.porcentaje) : '']))
  )
  const [proyectos, setProyectos] = useState<ProyectoOverhead[]>(inicial.proyectos)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const totalPct = useMemo(
    () => proyectos.reduce((s, p) => s + (parseFloat(pcts[p.proyectoId] || '0') || 0), 0),
    [proyectos, pcts]
  )
  const restantePct = Math.max(0, 100 - totalPct)
  const totalMonto = montoPorcentaje(poolReal, totalPct)
  const restanteMonto = montoPorcentaje(poolReal, restantePct)
  const excede = totalPct > 100.01

  const cargarMes = useCallback(async (nuevoAnio: number, nuevoMes: number) => {
    setCargando(true)
    try {
      const res = await fetch(`/api/contabilidad/overhead?anio=${nuevoAnio}&mes=${nuevoMes}`)
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error ?? 'No se pudo cargar el mes')
        return
      }
      const data: OverheadData = await res.json()
      setPoolReal(data.poolReal)
      setProyectos(data.proyectos)
      setPcts(Object.fromEntries(data.proyectos.map(p => [p.proyectoId, p.porcentaje ? String(p.porcentaje) : ''])))
    } catch {
      toast.error('Error de red al cargar el mes')
    } finally {
      setCargando(false)
    }
  }, [toast])

  const handleMesChange = (nuevoMes: number) => {
    setMes(nuevoMes)
    cargarMes(anio, nuevoMes)
  }
  const handleAnioChange = (nuevoAnio: number) => {
    setAnio(nuevoAnio)
    cargarMes(nuevoAnio, mes)
  }

  const handleGuardar = async () => {
    if (excede) {
      toast.error('La suma de porcentajes supera el 100%. Ajusta antes de guardar.')
      return
    }
    setGuardando(true)
    try {
      const asignaciones = proyectos.map(p => ({
        proyectoId: p.proyectoId,
        porcentaje: parseFloat(pcts[p.proyectoId] || '0') || 0,
      }))
      const res = await fetch('/api/contabilidad/overhead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio, mes, asignaciones }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error ?? 'No se pudo guardar el reparto')
        return
      }
      toast.exito('Reparto de overhead guardado')
      cargarMes(anio, mes)
    } catch {
      toast.error('Error de red al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const anioActual = new Date().getUTCFullYear()
  const anios = [anioActual - 2, anioActual - 1, anioActual, anioActual + 1]

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6" /> Overhead distribuido
          </h1>
          <p className="text-sm text-muted-foreground">
            Reparte los gastos fijos del mes (oficina, taller, general) entre los proyectos activos.
          </p>
        </div>
        <Link href="/contabilidad"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Volver a Contabilidad
        </Link>
      </div>

      {/* Selector de mes + pool */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Mes</label>
          <select value={mes} onChange={e => handleMesChange(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card min-w-[140px]">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Año</label>
          <select value={anio} onChange={e => handleAnioChange(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card">
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pool overhead del mes</p>
          <p className="text-2xl font-black text-foreground tabular-nums">{formatCurrency(poolReal)}</p>
        </div>
      </div>

      {/* Resumen del reparto */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">% asignado</p>
          <p className={`text-lg font-bold tabular-nums ${excede ? 'text-red-600' : 'text-foreground'}`}>
            {totalPct.toFixed(2)}%
          </p>
          <p className="text-xs text-muted-foreground">{formatCurrency(totalMonto)} repartido</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Sin repartir</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{restantePct.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(restanteMonto)} queda como overhead de empresa</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 col-span-2 lg:col-span-1 flex items-center">
          {excede ? (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> La suma supera el 100%
            </p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Info className="w-4 h-4 shrink-0" /> Lo no repartido no se carga a ningún proyecto
            </p>
          )}
        </div>
      </div>

      {/* Tabla de proyectos */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase w-32">%</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Porción (RD$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proyectos.map(p => {
                const pct = parseFloat(pcts[p.proyectoId] || '0') || 0
                const porcion = montoPorcentaje(poolReal, pct)
                return (
                  <tr key={p.proyectoId} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link href={`/proyectos/${p.proyectoId}`} className="font-medium text-foreground hover:text-primary">
                        {p.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.estado || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={pcts[p.proyectoId] ?? ''}
                        onChange={e => setPcts(prev => ({ ...prev, [p.proyectoId]: e.target.value }))}
                        className="h-8 w-24 text-right ml-auto tabular-nums"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(porcion)}</td>
                  </tr>
                )
              })}
              {proyectos.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                  No hay proyectos activos ni gastos en este mes
                </td></tr>
              )}
            </tbody>
            {proyectos.length > 0 && (
              <tfoot>
                <tr className="bg-muted/30 border-t border-border font-semibold">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${excede ? 'text-red-600' : ''}`}>{totalPct.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totalMonto)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleGuardar} disabled={guardando || cargando || excede}>
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar reparto'}
        </Button>
      </div>
    </div>
  )
}
