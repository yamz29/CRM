'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Filter, AlertCircle, Briefcase, Flag, Plus, X, Loader2, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Proyecto {
  id: number
  nombre: string
  cliente: string
  tipoProyecto: string
  estado: string
  fechaInicio: string | null
  fechaEstimada: string | null
  avance: number
  archivada: boolean
}

interface Hito {
  id: number
  nombre: string
  fecha: string
  descripcion: string | null
  color: string | null
  icono: string | null
  proyectoId: number | null
}

interface TareaG {
  id: number
  nombre: string
  fechaInicio: string
  fechaFin: string
  descripcion: string | null
  color: string | null
  avance: number
  proyectoId: number | null
}

type Escala = 'dia' | 'semana' | 'mes'

interface Props {
  proyectos: Proyecto[]
  hitos: Hito[]
  tareas: TareaG[]
  estadosExistentes: string[]
  estadosFiltro: string[]
  verArchivados: boolean
}

// Colores por estado (consistente con EstadoProyectoBadge)
const ESTADO_COLORS: Record<string, string> = {
  'Prospecto':     '#94a3b8',
  'En Cotización': '#8b5cf6',
  'Adjudicado':    '#eab308',
  'En Ejecución':  '#3b82f6',
  'Terminado':     '#22c55e',
  'Finalizado':    '#22c55e',
  'Pausado':       '#f97316',
  'Cancelado':     '#ef4444',
}

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Constantes de layout
const ROW_HEIGHT = 36
const HEADER_HEIGHT = 40
const LABEL_WIDTH = 260
const MIN_BAR_WIDTH = 8

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / (1000 * 60 * 60 * 24))
}

// Lunes de la semana de d
function startOfWeek(d: Date): Date {
  const c = startOfDay(d)
  const day = c.getDay() // 0=dom, 1=lun, ...
  const diff = day === 0 ? 6 : day - 1 // mover al lunes anterior
  return addDays(c, -diff)
}

// Devuelve número ISO de semana (aprox, suficiente visual)
function isoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function GanttProyectos({
  proyectos: proyectosIn,
  hitos,
  tareas,
  estadosExistentes,
  estadosFiltro,
  verArchivados,
}: Props) {
  const router = useRouter()
  const [localEstados, setLocalEstados] = useState<string[]>(estadosFiltro)
  const [localArchivados, setLocalArchivados] = useState(verArchivados)
  const [hitoModal, setHitoModal] = useState<Partial<Hito> | 'new' | null>(null)
  const [tareaModal, setTareaModal] = useState<Partial<TareaG> | 'new' | null>(null)
  const [escala, setEscala] = useState<Escala>('mes')
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<number>>(new Set())
  const [showOcultarMenu, setShowOcultarMenu] = useState(false)

  // Persistir ocultos en localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gantt-hidden-projects')
      if (saved) setHiddenProjectIds(new Set(JSON.parse(saved)))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('gantt-hidden-projects', JSON.stringify(Array.from(hiddenProjectIds)))
    } catch { /* ignore */ }
  }, [hiddenProjectIds])

  function toggleHidden(id: number) {
    setHiddenProjectIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // Separar proyectos con fechas vs sin fechas, y aplicar filtro de ocultos
  const { conFechas, sinFechas, ocultadosConFechas } = useMemo(() => {
    const con: Proyecto[] = []
    const sin: Proyecto[] = []
    const ocultados: Proyecto[] = []
    for (const p of proyectosIn) {
      const tieneFechas = !!(p.fechaInicio && p.fechaEstimada)
      if (hiddenProjectIds.has(p.id)) {
        if (tieneFechas) ocultados.push(p)
        continue
      }
      if (tieneFechas) con.push(p)
      else sin.push(p)
    }
    return { conFechas: con, sinFechas: sin, ocultadosConFechas: ocultados }
  }, [proyectosIn, hiddenProjectIds])

  // Rango de fechas: min y max considerando proyectos + tareas + hitos
  const { firstDay, lastDay, totalDays } = useMemo(() => {
    const fechas: Date[] = []
    for (const p of conFechas) {
      fechas.push(new Date(p.fechaInicio!))
      fechas.push(new Date(p.fechaEstimada!))
    }
    for (const t of tareas) {
      fechas.push(new Date(t.fechaInicio))
      fechas.push(new Date(t.fechaFin))
    }
    for (const h of hitos) {
      fechas.push(new Date(h.fecha))
    }
    if (fechas.length === 0) {
      const hoy = startOfDay(new Date())
      return { firstDay: addDays(hoy, -15), lastDay: addDays(hoy, 45), totalDays: 60 }
    }
    let min = fechas[0], max = fechas[0]
    for (const f of fechas) {
      if (f < min) min = f
      if (f > max) max = f
    }
    // Padding según escala
    const padDays = escala === 'dia' ? 3 : escala === 'semana' ? 7 : 30
    const first = addDays(startOfDay(min), -padDays)
    const last = addDays(startOfDay(max), padDays)
    return { firstDay: first, lastDay: last, totalDays: daysBetween(first, last) + 1 }
  }, [conFechas, tareas, hitos, escala])

  // Ancho por día según escala
  const dayWidth = escala === 'dia' ? 28 : escala === 'semana' ? 10 : 3
  const chartWidth = LABEL_WIDTH + totalDays * dayWidth

  // Helper: fecha → X
  function dateToX(dateIso: string | Date): number | null {
    const d = typeof dateIso === 'string' ? new Date(dateIso) : dateIso
    const days = daysBetween(firstDay, d)
    if (days < 0 || days > totalDays) return null
    return LABEL_WIDTH + days * dayWidth
  }

  // Hoy line
  const hoyX = useMemo(() => dateToX(new Date()), [firstDay, dayWidth])

  // Unidades del header según escala: lista de { start, label, isPrimary, labelSecondary }
  const headerUnits = useMemo(() => {
    const units: Array<{ start: Date; width: number; label: string; labelSecondary?: string; isPrimary: boolean }> = []
    if (escala === 'dia') {
      // Cada día es una columna. Label secundario = mes cuando cambia.
      let prevMonth = -1
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(firstDay, i)
        const m = d.getMonth()
        units.push({
          start: d,
          width: dayWidth,
          label: String(d.getDate()),
          labelSecondary: m !== prevMonth ? `${MESES_ES[m]} ${d.getFullYear()}` : undefined,
          isPrimary: d.getDay() === 1 || i === 0, // resalta lunes
        })
        prevMonth = m
      }
    } else if (escala === 'semana') {
      // Columna = 7 días. Start lunes.
      let cursor = startOfWeek(firstDay)
      if (cursor < firstDay) cursor = startOfWeek(firstDay)
      let prevMonth = -1
      while (cursor < lastDay) {
        const startDays = daysBetween(firstDay, cursor)
        const endDays = Math.min(totalDays, startDays + 7)
        const width = (endDays - Math.max(0, startDays)) * dayWidth
        const m = cursor.getMonth()
        units.push({
          start: new Date(cursor),
          width,
          label: `S${isoWeek(cursor)}`,
          labelSecondary: m !== prevMonth ? `${MESES_ES[m]} ${cursor.getFullYear()}` : undefined,
          isPrimary: cursor.getDate() <= 7,
        })
        prevMonth = m
        cursor = addDays(cursor, 7)
      }
    } else {
      // Meses
      let cursor = startOfMonth(firstDay)
      while (cursor <= lastDay) {
        const next = addMonths(cursor, 1)
        const startX = Math.max(0, daysBetween(firstDay, cursor))
        const endX = Math.min(totalDays, daysBetween(firstDay, next))
        const width = (endX - startX) * dayWidth
        units.push({
          start: new Date(cursor),
          width,
          label: MESES_ES[cursor.getMonth()],
          labelSecondary: cursor.getMonth() === 0 || cursor.getTime() === startOfMonth(firstDay).getTime()
            ? String(cursor.getFullYear())
            : undefined,
          isPrimary: cursor.getMonth() === 0,
        })
        cursor = next
      }
    }
    return units
  }, [firstDay, lastDay, totalDays, dayWidth, escala])

  const chartHeight = HEADER_HEIGHT + (tareas.length + conFechas.length) * ROW_HEIGHT + 10

  // Mapa de hitos por proyectoId (para renderizado rápido)
  const hitosPorProyecto = useMemo(() => {
    const m = new Map<number | null, Hito[]>()
    for (const h of hitos) {
      const key = h.proyectoId ?? null
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(h)
    }
    return m
  }, [hitos])

  const hitosGlobales = hitosPorProyecto.get(null) ?? []

  // Función para calcular x e width de una barra entre dos fechas ISO
  function barGeometry(iniIso: string, finIso: string) {
    const ini = new Date(iniIso)
    const fin = new Date(finIso)
    const x1 = LABEL_WIDTH + daysBetween(firstDay, ini) * dayWidth
    const x2 = LABEL_WIDTH + (daysBetween(firstDay, fin) + 1) * dayWidth
    return { x: x1, width: Math.max(MIN_BAR_WIDTH, x2 - x1) }
  }

  function toggleEstado(e: string) {
    setLocalEstados(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])
  }

  function aplicar() {
    const params = new URLSearchParams()
    if (localEstados.length > 0) params.set('estados', localEstados.join(','))
    if (localArchivados) params.set('archivados', '1')
    router.push(`/proyectos/gantt?${params.toString()}`)
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
            <h1 className="text-2xl font-bold text-foreground">Cronograma de proyectos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Vista general del desarrollo de todos los proyectos en el tiempo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de escala */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['dia', 'semana', 'mes'] as Escala[]).map(e => (
              <button
                key={e}
                onClick={() => setEscala(e)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  escala === e
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {e === 'dia' ? 'Días' : e === 'semana' ? 'Semanas' : 'Meses'}
              </button>
            ))}
          </div>
          {/* Dropdown ocultar proyectos */}
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setShowOcultarMenu(v => !v)}>
              {hiddenProjectIds.size > 0 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Mostrar/ocultar
              {hiddenProjectIds.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-bold">
                  {hiddenProjectIds.size}
                </span>
              )}
            </Button>
            {showOcultarMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOcultarMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl w-80 max-h-96 overflow-hidden flex flex-col">
                  <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Proyectos visibles</p>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => setHiddenProjectIds(new Set())}
                        className="text-primary hover:underline"
                      >
                        Mostrar todos
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        onClick={() => setHiddenProjectIds(new Set(proyectosIn.map(p => p.id)))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Ocultar todos
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 py-1">
                    {proyectosIn.map(p => {
                      const isVisible = !hiddenProjectIds.has(p.id)
                      return (
                        <label
                          key={p.id}
                          className="flex items-start gap-2 px-3 py-1.5 hover:bg-muted/30 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleHidden(p.id)}
                            className="mt-1 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: ESTADO_COLORS[p.estado] ?? '#94a3b8' }}
                              />
                              <span className="text-xs font-medium text-foreground truncate">{p.nombre}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{p.cliente}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setTareaModal('new')}>
            <Plus className="w-4 h-4" /> Tarea
          </Button>
          <Button size="sm" onClick={() => setHitoModal('new')}>
            <Flag className="w-4 h-4" /> Hito
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="w-3.5 h-3.5" /> Filtros
          </div>
          <div className="flex flex-wrap gap-1.5">
            {estadosExistentes.map(e => (
              <button
                key={e}
                onClick={() => toggleEstado(e)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
                  localEstados.includes(e)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ESTADO_COLORS[e] ?? '#94a3b8' }} />
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={localArchivados} onChange={e => setLocalArchivados(e.target.checked)} />
              Incluir archivados
            </label>
            <Button size="sm" onClick={aplicar}>Aplicar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Gantt */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {conFechas.length} proyecto{conFechas.length === 1 ? '' : 's'} en el cronograma
              </p>
            </div>
            {/* Leyenda */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {Object.entries(ESTADO_COLORS)
                .filter(([e]) => estadosExistentes.includes(e))
                .map(([e, c]) => (
                  <span key={e} className="flex items-center gap-1">
                    <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: c }} />
                    {e}
                  </span>
                ))}
            </div>
          </div>

          {conFechas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No hay proyectos con fechas de inicio y fin configuradas
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-md">
                Edita cada proyecto y configura <strong>Fecha de inicio</strong> y <strong>Fecha estimada</strong> para que aparezca en el cronograma.
              </p>
            </div>
          ) : (
            <div className="flex">
              {/* ═══ COLUMNA FIJA: labels de proyectos y tareas ═══ */}
              <div className="shrink-0 border-r border-border bg-card print:border-r-2">
                <svg
                  width={LABEL_WIDTH}
                  height={chartHeight}
                  className="block"
                >
                  {/* Fondo del área de labels */}
                  <rect x={0} y={0} width={LABEL_WIDTH} height={chartHeight} className="fill-card" />

                  {/* Header con etiqueta */}
                  <rect x={0} y={0} width={LABEL_WIDTH} height={HEADER_HEIGHT} className="fill-muted/40" />
                  <text
                    x={12}
                    y={HEADER_HEIGHT / 2 + 4}
                    className="fill-muted-foreground text-[11px] font-semibold uppercase tracking-wide"
                  >
                    Proyecto
                  </text>

                  {/* Líneas horizontales de cada fila */}
                  {Array.from({ length: tareas.length + conFechas.length }).map((_, idx) => {
                    const y = HEADER_HEIGHT + idx * ROW_HEIGHT
                    return (
                      <line
                        key={idx}
                        x1={0} y1={y}
                        x2={LABEL_WIDTH} y2={y}
                        className="stroke-border/50"
                        strokeWidth={0.5}
                      />
                    )
                  })}

                  {/* Separador tareas/proyectos */}
                  {tareas.length > 0 && (
                    <line
                      x1={0}
                      y1={HEADER_HEIGHT + tareas.length * ROW_HEIGHT}
                      x2={LABEL_WIDTH}
                      y2={HEADER_HEIGHT + tareas.length * ROW_HEIGHT}
                      className="stroke-border"
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Labels de tareas (arriba) */}
                  {tareas.map((t, idx) => {
                    const y = HEADER_HEIGHT + idx * ROW_HEIGHT
                    const rowCenterY = y + ROW_HEIGHT / 2
                    const proyNombre = t.proyectoId
                      ? proyectosIn.find(p => p.id === t.proyectoId)?.nombre
                      : null
                    return (
                      <g
                        key={`tl-${t.id}`}
                        className="cursor-pointer"
                        onClick={() => setTareaModal(t)}
                      >
                        <rect x={0} y={y} width={LABEL_WIDTH} height={ROW_HEIGHT}
                          className="fill-transparent hover:fill-muted/30 transition-colors" />
                        <text x={12} y={rowCenterY - 2}
                          className="fill-foreground text-xs font-medium pointer-events-none">
                          ◇ {t.nombre.length > 32 ? t.nombre.slice(0, 30) + '…' : t.nombre}
                        </text>
                        <text x={12} y={rowCenterY + 11}
                          className="fill-muted-foreground text-[10px] pointer-events-none">
                          {proyNombre ? `En: ${proyNombre}` : 'Tarea global'}
                        </text>
                      </g>
                    )
                  })}

                  {/* Labels de proyectos */}
                  {conFechas.map((p, idx) => {
                    const y = HEADER_HEIGHT + (tareas.length + idx) * ROW_HEIGHT
                    const rowCenterY = y + ROW_HEIGHT / 2
                    return (
                      <g
                        key={`pl-${p.id}`}
                        className="cursor-pointer"
                        onClick={() => router.push(`/proyectos/${p.id}`)}
                      >
                        <rect x={0} y={y} width={LABEL_WIDTH} height={ROW_HEIGHT}
                          className="fill-transparent hover:fill-muted/30 transition-colors" />
                        <text
                          x={12}
                          y={rowCenterY - 2}
                          className="fill-foreground text-xs font-semibold pointer-events-none"
                        >
                          {p.nombre.length > 32 ? p.nombre.slice(0, 30) + '…' : p.nombre}
                        </text>
                        <text
                          x={12}
                          y={rowCenterY + 11}
                          className="fill-muted-foreground text-[10px] pointer-events-none"
                        >
                          {p.cliente.length > 34 ? p.cliente.slice(0, 32) + '…' : p.cliente}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* ═══ COLUMNA SCROLLEABLE: timeline ═══ */}
              <div className="overflow-x-auto flex-1">
              <svg
                width={chartWidth - LABEL_WIDTH}
                height={chartHeight}
                viewBox={`${LABEL_WIDTH} 0 ${chartWidth - LABEL_WIDTH} ${chartHeight}`}
                className="block"
                style={{ minWidth: '100%' }}
              >
                {/* Header: franja superior */}
                <rect x={LABEL_WIDTH} y={0} width={totalDays * dayWidth} height={HEADER_HEIGHT} className="fill-muted/40" />

                {/* Unidades del header según escala */}
                {headerUnits.map((u, i) => {
                  const x = LABEL_WIDTH + daysBetween(firstDay, u.start) * dayWidth
                  return (
                    <g key={i}>
                      {/* Divisor vertical */}
                      <line
                        x1={x} y1={0} x2={x} y2={chartHeight}
                        className="stroke-border"
                        strokeWidth={u.isPrimary ? 1 : 0.4}
                        opacity={u.isPrimary ? 1 : 0.6}
                      />
                      {/* Texto principal (día / semana / mes) */}
                      <text
                        x={x + u.width / 2}
                        y={HEADER_HEIGHT / 2 + 6}
                        textAnchor="middle"
                        className="fill-foreground text-[11px] font-medium"
                      >
                        {u.label}
                      </text>
                      {/* Texto secundario (mes+año cuando cambia) */}
                      {u.labelSecondary && (
                        <text
                          x={x + 4}
                          y={14}
                          className="fill-muted-foreground text-[10px] font-semibold"
                        >
                          {u.labelSecondary}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Líneas horizontales por fila (tareas + proyectos) */}
                {Array.from({ length: tareas.length + conFechas.length }).map((_, idx) => {
                  const y = HEADER_HEIGHT + idx * ROW_HEIGHT
                  return (
                    <line
                      key={idx}
                      x1={LABEL_WIDTH} y1={y}
                      x2={chartWidth} y2={y}
                      className="stroke-border/50"
                      strokeWidth={0.5}
                    />
                  )
                })}

                {/* Separador entre tareas globales y proyectos */}
                {tareas.length > 0 && (
                  <line
                    x1={LABEL_WIDTH}
                    y1={HEADER_HEIGHT + tareas.length * ROW_HEIGHT}
                    x2={chartWidth}
                    y2={HEADER_HEIGHT + tareas.length * ROW_HEIGHT}
                    className="stroke-border"
                    strokeWidth={1.5}
                  />
                )}

                {/* Línea de "hoy" */}
                {hoyX != null && (
                  <g>
                    <line
                      x1={hoyX} y1={HEADER_HEIGHT}
                      x2={hoyX} y2={chartHeight}
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    <circle cx={hoyX} cy={HEADER_HEIGHT} r={3} fill="#ef4444" />
                  </g>
                )}

                {/* Hitos globales — líneas verticales que cruzan todo el Gantt */}
                {hitosGlobales.map(h => {
                  const x = dateToX(h.fecha)
                  if (x == null) return null
                  const color = h.color || '#8b5cf6'
                  return (
                    <g
                      key={`hg-${h.id}`}
                      className="cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setHitoModal(h) }}
                    >
                      <title>
                        {(h.icono ? h.icono + ' ' : '') + h.nombre}{'\n'}
                        {new Date(h.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        {h.descripcion ? '\n' + h.descripcion : ''}
                      </title>
                      <line
                        x1={x} y1={HEADER_HEIGHT}
                        x2={x} y2={chartHeight}
                        stroke={color}
                        strokeWidth={1.2}
                        strokeDasharray="3 3"
                        opacity={0.75}
                      />
                      {/* Bandera en el header */}
                      <g transform={`translate(${x - 6}, ${HEADER_HEIGHT - 18})`}>
                        <rect width={12} height={14} rx={2} fill={color} />
                        <text x={6} y={11} textAnchor="middle" className="text-[9px] fill-white font-bold">
                          {h.icono || '●'}
                        </text>
                      </g>
                    </g>
                  )
                })}

                {/* Filas de tareas globales / por proyecto (arriba) — solo barras, no labels */}
                {tareas.map((t, idx) => {
                  const y = HEADER_HEIGHT + idx * ROW_HEIGHT
                  const rowCenterY = y + ROW_HEIGHT / 2
                  const { x, width } = barGeometry(t.fechaInicio, t.fechaFin)
                  const tcolor = t.color || '#0ea5e9'
                  const progressWidth = Math.min(width, width * (t.avance / 100))
                  return (
                    <g
                      key={`t-${t.id}`}
                      className="cursor-pointer"
                      onClick={() => setTareaModal(t)}
                    >
                      <rect x={LABEL_WIDTH} y={y} width={chartWidth - LABEL_WIDTH} height={ROW_HEIGHT}
                        className="fill-transparent hover:fill-muted/30 transition-colors" />
                      <title>
                        {t.nombre}{'\n'}
                        {new Date(t.fechaInicio).toLocaleDateString('es-DO')} → {new Date(t.fechaFin).toLocaleDateString('es-DO')}{'\n'}
                        Avance: {t.avance}%
                        {t.descripcion ? '\n' + t.descripcion : ''}
                      </title>
                      {/* Barra con estilo punteado para diferenciar de proyectos */}
                      <rect
                        x={x} y={rowCenterY - 8}
                        width={width} height={16}
                        rx={4} ry={4}
                        fill={tcolor}
                        opacity={0.25}
                      />
                      {t.avance > 0 && (
                        <rect
                          x={x} y={rowCenterY - 8}
                          width={progressWidth} height={16}
                          rx={4} ry={4}
                          fill={tcolor}
                        />
                      )}
                      <rect
                        x={x} y={rowCenterY - 8}
                        width={width} height={16}
                        rx={4} ry={4}
                        fill="none" stroke={tcolor} strokeWidth={1} strokeDasharray="4 2"
                      />
                      {width > 40 && (
                        <text
                          x={x + width / 2}
                          y={rowCenterY + 4}
                          textAnchor="middle"
                          className="text-[10px] font-semibold pointer-events-none"
                          fill={t.avance >= 50 ? '#fff' : tcolor}
                        >
                          {t.avance}%
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Filas: label + barra de cada proyecto */}
                {conFechas.map((p, idx) => {
                  const y = HEADER_HEIGHT + (tareas.length + idx) * ROW_HEIGHT
                  const rowCenterY = y + ROW_HEIGHT / 2
                  const { x, width } = barGeometry(p.fechaInicio!, p.fechaEstimada!)
                  const color = ESTADO_COLORS[p.estado] ?? '#94a3b8'
                  const progressWidth = Math.min(width, width * (p.avance / 100))
                  return (
                    <g
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/proyectos/${p.id}`)}
                    >
                      {/* Fondo de fila (hover invisible) */}
                      <rect
                        x={LABEL_WIDTH} y={y}
                        width={chartWidth - LABEL_WIDTH} height={ROW_HEIGHT}
                        className="fill-transparent hover:fill-muted/30 transition-colors"
                      />

                      {/* Barra */}
                      <g>
                        <title>
                          {p.nombre} · {p.cliente}{'\n'}
                          {fmtFecha(p.fechaInicio)} → {fmtFecha(p.fechaEstimada)}{'\n'}
                          Estado: {p.estado} · Avance: {p.avance}%
                        </title>
                        {/* Barra base (fondo suave del color) */}
                        <rect
                          x={x}
                          y={rowCenterY - 10}
                          width={width}
                          height={20}
                          rx={10}
                          ry={10}
                          fill={color}
                          opacity={0.25}
                        />
                        {/* Barra de progreso sólido */}
                        {p.avance > 0 && (
                          <rect
                            x={x}
                            y={rowCenterY - 10}
                            width={progressWidth}
                            height={20}
                            rx={10}
                            ry={10}
                            fill={color}
                          />
                        )}
                        {/* Borde */}
                        <rect
                          x={x}
                          y={rowCenterY - 10}
                          width={width}
                          height={20}
                          rx={10}
                          ry={10}
                          fill="none"
                          stroke={color}
                          strokeWidth={1}
                        />
                        {/* Label de % sobre la barra si cabe */}
                        {width > 40 && (
                          <text
                            x={x + width / 2}
                            y={rowCenterY + 4}
                            textAnchor="middle"
                            className="text-[10px] font-semibold pointer-events-none"
                            fill={p.avance >= 50 ? '#fff' : color}
                          >
                            {p.avance}%
                          </text>
                        )}
                      </g>

                      {/* Hitos asociados a este proyecto — rombos sobre la fila */}
                      {(hitosPorProyecto.get(p.id) ?? []).map(h => {
                        const hx = dateToX(h.fecha)
                        if (hx == null) return null
                        const hcolor = h.color || '#f59e0b'
                        return (
                          <g
                            key={`hp-${h.id}`}
                            className="cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setHitoModal(h) }}
                          >
                            <title>
                              {(h.icono ? h.icono + ' ' : '') + h.nombre}{'\n'}
                              {new Date(h.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}
                              {h.descripcion ? '\n' + h.descripcion : ''}
                            </title>
                            {/* Rombo (milestone típico de MS Project) */}
                            <polygon
                              points={`${hx},${rowCenterY - 9} ${hx + 7},${rowCenterY} ${hx},${rowCenterY + 9} ${hx - 7},${rowCenterY}`}
                              fill={hcolor}
                              stroke="#fff"
                              strokeWidth={1}
                            />
                            {h.icono && (
                              <text
                                x={hx}
                                y={rowCenterY + 3}
                                textAnchor="middle"
                                className="text-[9px] pointer-events-none"
                                fill="#fff"
                              >
                                {h.icono}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proyectos sin fecha */}
      {sinFechas.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {sinFechas.length} proyecto{sinFechas.length === 1 ? '' : 's'} sin fechas configuradas
                </p>
                <p className="text-xs text-muted-foreground">
                  No aparecen en el cronograma hasta que les configures fecha de inicio y fin estimada.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sinFechas.map(p => (
                <Link
                  key={p.id}
                  href={`/proyectos/${p.id}/editar`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-lg border border-border transition-colors"
                >
                  <Briefcase className="w-3 h-3 text-muted-foreground" />
                  <span className="text-foreground">{p.nombre}</span>
                  <span className="text-muted-foreground">— {p.cliente}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de crear/editar hito */}
      {hitoModal !== null && (
        <HitoModal
          hito={hitoModal === 'new' ? null : (hitoModal as Hito)}
          proyectos={proyectosIn}
          onClose={() => setHitoModal(null)}
          onSaved={() => { setHitoModal(null); router.refresh() }}
        />
      )}

      {/* Modal de crear/editar tarea */}
      {tareaModal !== null && (
        <TareaModal
          tarea={tareaModal === 'new' ? null : (tareaModal as TareaG)}
          proyectos={proyectosIn}
          onClose={() => setTareaModal(null)}
          onSaved={() => { setTareaModal(null); router.refresh() }}
        />
      )}
    </>
  )
}

// ── Modal para crear / editar / eliminar hito ─────────────────────────

interface HitoModalProps {
  hito: Hito | null
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: () => void
}

const COLORES_PRESET = [
  { label: 'Morado', value: '#8b5cf6' },
  { label: 'Rojo', value: '#ef4444' },
  { label: 'Naranja', value: '#f59e0b' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Rosa', value: '#ec4899' },
]

const ICONOS_PRESET = ['🎯', '🚩', '📅', '💰', '✅', '⚠️', '🔑', '📦', '🏗️', '📝', '🎉', '⭐']

function HitoModal({ hito, proyectos, onClose, onSaved }: HitoModalProps) {
  const isEdit = hito != null
  const [nombre, setNombre] = useState(hito?.nombre ?? '')
  const [fecha, setFecha] = useState(
    hito?.fecha ? new Date(hito.fecha).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [descripcion, setDescripcion] = useState(hito?.descripcion ?? '')
  const [color, setColor] = useState(hito?.color ?? '#8b5cf6')
  const [icono, setIcono] = useState(hito?.icono ?? '')
  const [proyectoId, setProyectoId] = useState<string>(
    hito?.proyectoId ? String(hito.proyectoId) : ''
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!nombre.trim()) { setError('Nombre requerido'); return }
    setSaving(true); setError(null)
    try {
      const url = isEdit ? `/api/hitos/${hito!.id}` : '/api/hitos'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          fecha,
          descripcion: descripcion.trim() || null,
          color,
          icono: icono || null,
          proyectoId: proyectoId ? parseInt(proyectoId) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al guardar')
      } else {
        onSaved()
      }
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!hito || !confirm(`¿Eliminar el hito "${hito.nombre}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/hitos/${hito.id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Flag className="w-4 h-4" />
            {isEdit ? 'Editar hito' : 'Nuevo hito'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="ej: Firma de contrato, Entrega parcial..."
              autoFocus
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Proyecto</label>
              <select
                value={proyectoId}
                onChange={e => setProyectoId(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-input text-foreground"
              >
                <option value="">Hito global (sin proyecto)</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORES_PRESET.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ícono (opcional)</label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setIcono('')}
                className={`w-7 h-7 text-xs rounded border transition-colors ${
                  icono === '' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                }`}
              >
                —
              </button>
              {ICONOS_PRESET.map(i => (
                <button
                  key={i}
                  onClick={() => setIcono(i)}
                  className={`w-7 h-7 text-sm rounded border transition-colors ${
                    icono === i ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Notas opcionales..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving || deleting} className="text-red-500 hover:text-red-700 hover:bg-red-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Eliminar
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !nombre.trim()}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : isEdit ? 'Actualizar' : 'Crear hito'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal para crear / editar / eliminar tarea gantt ──────────────────

interface TareaModalProps {
  tarea: TareaG | null
  proyectos: Proyecto[]
  onClose: () => void
  onSaved: () => void
}

function TareaModal({ tarea, proyectos, onClose, onSaved }: TareaModalProps) {
  const isEdit = tarea != null
  const hoy = new Date().toISOString().slice(0, 10)
  const [nombre, setNombre] = useState(tarea?.nombre ?? '')
  const [fechaInicio, setFechaInicio] = useState(
    tarea?.fechaInicio ? new Date(tarea.fechaInicio).toISOString().slice(0, 10) : hoy
  )
  const [fechaFin, setFechaFin] = useState(
    tarea?.fechaFin ? new Date(tarea.fechaFin).toISOString().slice(0, 10) : hoy
  )
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '')
  const [color, setColor] = useState(tarea?.color ?? '#0ea5e9')
  const [avance, setAvance] = useState(tarea?.avance ?? 0)
  const [proyectoId, setProyectoId] = useState<string>(
    tarea?.proyectoId ? String(tarea.proyectoId) : ''
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!nombre.trim()) { setError('Nombre requerido'); return }
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      setError('La fecha de fin debe ser posterior al inicio'); return
    }
    setSaving(true); setError(null)
    try {
      const url = isEdit ? `/api/tareas-gantt/${tarea!.id}` : '/api/tareas-gantt'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          fechaInicio,
          fechaFin,
          descripcion: descripcion.trim() || null,
          color,
          avance,
          proyectoId: proyectoId ? parseInt(proyectoId) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al guardar')
      } else {
        onSaved()
      }
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!tarea || !confirm(`¿Eliminar la tarea "${tarea.nombre}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tareas-gantt/${tarea.id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span>◇</span> {isEdit ? 'Editar tarea' : 'Nueva tarea'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="ej: Levantamiento de obra, Vacaciones equipo..."
              autoFocus
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Inicio *</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Fin *</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Proyecto</label>
            <select
              value={proyectoId}
              onChange={e => setProyectoId(e.target.value)}
              className="w-full h-9 px-2 text-sm border border-border rounded-lg bg-input text-foreground"
            >
              <option value="">Tarea global (sin proyecto)</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORES_PRESET.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Avance: {avance}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={avance}
              onChange={e => setAvance(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Notas opcionales..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving || deleting} className="text-red-500 hover:text-red-700 hover:bg-red-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Eliminar
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !nombre.trim()}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</> : isEdit ? 'Actualizar' : 'Crear tarea'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
