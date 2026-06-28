'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Layers, Save, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableFooter, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
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
  const [sugiriendo, setSugiriendo] = useState(false)
  // Desglose por proyecto de la última sugerencia (puntos de % por señal).
  type Desglose = { costoMes: number; horas: number; costoAcum: number; presupuesto: number; avance: number }
  const [desgloses, setDesgloses] = useState<Record<number, Desglose>>({})

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
      setDesgloses({})
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

  const handleSugerir = async () => {
    setSugiriendo(true)
    try {
      const res = await fetch(`/api/contabilidad/overhead/sugerencia?anio=${anio}&mes=${mes}`)
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error ?? 'No se pudo calcular la sugerencia')
        return
      }
      const data: { sugerencias: { proyectoId: number; porcentaje: number; desglose: Desglose }[] } = await res.json()
      if (data.sugerencias.length === 0) {
        toast.error('No hay datos suficientes para sugerir un reparto este mes')
        return
      }
      setPcts(prev => {
        const next = { ...prev }
        for (const s of data.sugerencias) next[s.proyectoId] = String(s.porcentaje)
        return next
      })
      setDesgloses(Object.fromEntries(data.sugerencias.map(s => [s.proyectoId, s.desglose])))
      toast.exito('Sugerencia aplicada — revisa antes de guardar')
    } catch {
      toast.error('Error de red al calcular la sugerencia')
    } finally {
      setSugiriendo(false)
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right w-32">%</TableHead>
              <TableHead className="text-right">Porción (RD$)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proyectos.map(p => {
              const pct = parseFloat(pcts[p.proyectoId] || '0') || 0
              const porcion = montoPorcentaje(poolReal, pct)
              return (
                <TableRow key={p.proyectoId}>
                  <TableCell>
                    <Link href={`/proyectos/${p.proyectoId}`} className="font-medium text-foreground hover:text-primary">
                      {p.nombre}
                    </Link>
                    {desgloses[p.proyectoId] && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span title="Costo del mes">costo {desgloses[p.proyectoId].costoMes.toFixed(1)}</span>
                        <span title="Horas del personal">horas {desgloses[p.proyectoId].horas.toFixed(1)}</span>
                        <span title="Costo acumulado">acum {desgloses[p.proyectoId].costoAcum.toFixed(1)}</span>
                        <span title="Presupuesto estimado">presup {desgloses[p.proyectoId].presupuesto.toFixed(1)}</span>
                        <span title="Avance físico">avance {desgloses[p.proyectoId].avance.toFixed(1)}</span>
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.estado || '—'}</TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(porcion)}</TableCell>
                </TableRow>
              )
            })}
            {proyectos.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                No hay proyectos activos ni gastos en este mes
              </TableCell></TableRow>
            )}
          </TableBody>
          {proyectos.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${excede ? 'text-red-600' : ''}`}>{totalPct.toFixed(2)}%</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totalMonto)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleSugerir} disabled={sugiriendo || cargando || guardando}>
          <Sparkles className="w-4 h-4" /> {sugiriendo ? 'Calculando...' : 'Sugerir %'}
        </Button>
        <Button onClick={handleGuardar} disabled={guardando || cargando || excede}>
          <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar reparto'}
        </Button>
      </div>

      {/* Nota: cómo se calcula el % sugerido */}
      <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="w-4 h-4 shrink-0" /> ¿Cómo se calcula el % sugerido?
        </p>
        <p>
          A cada proyecto activo del mes se le asigna un <strong>índice de esfuerzo</strong> que
          mezcla cinco señales, cada una comparada contra el total del mes:
        </p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><strong>Costo del mes (35%)</strong> — gastos directos del proyecto en el mes.</li>
          <li><strong>Horas del personal (25%)</strong> — horas registradas al proyecto en el mes.</li>
          <li><strong>Costo acumulado (20%)</strong> — total gastado en el proyecto hasta la fecha.</li>
          <li><strong>Presupuesto estimado (15%)</strong> — tamaño contratado del proyecto.</li>
          <li><strong>Avance físico (5%)</strong> — % de avance actual (aproximado en meses pasados).</li>
        </ul>
        <p>
          Ese índice se <strong>prorratea por los días que el proyecto estuvo activo</strong> dentro
          del mes y luego se reparte el 100% del pool entre los proyectos. El desglose bajo cada
          nombre muestra cuántos puntos aportó cada señal. La sugerencia es solo un punto de
          partida: puedes ajustar cualquier % antes de guardar.
        </p>
      </div>
    </div>
  )
}
