'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Filter, AlertCircle, Briefcase, Flag, Plus, X, Loader2, Trash2 } from 'lucide-react'
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

interface Props {
  proyectos: Proyecto[]
  hitos: Hito[]
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

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function GanttProyectos({
  proyectos: proyectosIn,
  hitos,
  estadosExistentes,
  estadosFiltro,
  verArchivados,
}: Props) {
  const router = useRouter()
  const [localEstados, setLocalEstados] = useState<string[]>(estadosFiltro)
  const [localArchivados, setLocalArchivados] = useState(verArchivados)
  const [hitoModal, setHitoModal] = useState<Partial<Hito> | 'new' | null>(null)

  // Separar proyectos con fechas vs sin fechas
  const { conFechas, sinFechas } = useMemo(() => {
    const con: Proyecto[] = []
    const sin: Proyecto[] = []
    for (const p of proyectosIn) {
      if (p.fechaInicio && p.fechaEstimada) con.push(p)
      else sin.push(p)
    }
    return { conFechas: con, sinFechas: sin }
  }, [proyectosIn])

  // Calcular rango de fechas del eje X — por mes
  const { firstMonth, totalMonths, months } = useMemo(() => {
    if (conFechas.length === 0) {
      const hoy = new Date()
      const first = startOfMonth(hoy)
      return { firstMonth: first, totalMonths: 6, months: [] }
    }
    let minDate = new Date(conFechas[0].fechaInicio!)
    let maxDate = new Date(conFechas[0].fechaEstimada!)
    for (const p of conFechas) {
      const ini = new Date(p.fechaInicio!)
      const fin = new Date(p.fechaEstimada!)
      if (ini < minDate) minDate = ini
      if (fin > maxDate) maxDate = fin
    }
    // Pad un mes antes y después
    const first = addMonths(startOfMonth(minDate), -1)
    const lastMonthStart = startOfMonth(maxDate)
    const total = monthsBetween(first, lastMonthStart) + 2 // incluir último + 1 pad
    const list: Date[] = []
    for (let i = 0; i < total; i++) list.push(addMonths(first, i))
    return { firstMonth: first, totalMonths: total, months: list }
  }, [conFechas])

  // Ancho de columna por mes (responsive según cantidad)
  const monthWidth = Math.max(60, Math.min(140, 1200 / Math.max(1, totalMonths)))
  const chartWidth = LABEL_WIDTH + totalMonths * monthWidth
  const chartHeight = HEADER_HEIGHT + conFechas.length * ROW_HEIGHT + 10

  // Hoy line
  const hoyX = useMemo(() => {
    const hoy = new Date()
    const hoyStart = startOfMonth(hoy)
    const monthsFromStart = monthsBetween(firstMonth, hoyStart)
    if (monthsFromStart < 0 || monthsFromStart >= totalMonths) return null
    // Posición proporcional dentro del mes
    const daysInMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    const dayRatio = (hoy.getDate() - 1) / daysInMonth
    return LABEL_WIDTH + (monthsFromStart + dayRatio) * monthWidth
  }, [firstMonth, totalMonths, monthWidth])

  // Función para calcular posición X de una fecha cualquiera
  function dateToX(dateIso: string): number | null {
    const d = new Date(dateIso)
    const monthStart = startOfMonth(d)
    const monthsFromStart = monthsBetween(firstMonth, monthStart)
    if (monthsFromStart < 0 || monthsFromStart >= totalMonths) return null
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const dayRatio = (d.getDate() - 1) / daysInMonth
    return LABEL_WIDTH + (monthsFromStart + dayRatio) * monthWidth
  }

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

  // Función para calcular x e width de una barra de proyecto
  function barGeometry(p: Proyecto) {
    const ini = new Date(p.fechaInicio!)
    const fin = new Date(p.fechaEstimada!)
    const iniMonthStart = startOfMonth(ini)
    const finMonthStart = startOfMonth(fin)
    const daysIni = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate()
    const daysFin = new Date(fin.getFullYear(), fin.getMonth() + 1, 0).getDate()

    const x1 =
      LABEL_WIDTH +
      monthsBetween(firstMonth, iniMonthStart) * monthWidth +
      ((ini.getDate() - 1) / daysIni) * monthWidth
    const x2 =
      LABEL_WIDTH +
      monthsBetween(firstMonth, finMonthStart) * monthWidth +
      (fin.getDate() / daysFin) * monthWidth
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
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setHitoModal('new')}>
            <Flag className="w-4 h-4" /> Agregar hito
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
            <div className="overflow-x-auto">
              <svg
                width={chartWidth}
                height={chartHeight}
                className="block"
                style={{ minWidth: '100%' }}
              >
                {/* Columna de labels (nombre + cliente) fondo */}
                <rect x={0} y={0} width={LABEL_WIDTH} height={chartHeight} className="fill-muted/20" />

                {/* Header: fila de meses */}
                <rect x={LABEL_WIDTH} y={0} width={totalMonths * monthWidth} height={HEADER_HEIGHT} className="fill-muted/40" />

                {months.map((m, i) => {
                  const x = LABEL_WIDTH + i * monthWidth
                  const isYearStart = m.getMonth() === 0 || i === 0
                  return (
                    <g key={i}>
                      {/* Divisor vertical */}
                      <line
                        x1={x} y1={0} x2={x} y2={chartHeight}
                        className="stroke-border"
                        strokeWidth={isYearStart ? 1 : 0.5}
                      />
                      {/* Texto del mes */}
                      <text
                        x={x + monthWidth / 2}
                        y={HEADER_HEIGHT / 2 + 4}
                        textAnchor="middle"
                        className="fill-foreground text-xs font-medium"
                      >
                        {MESES_ES[m.getMonth()]}
                      </text>
                      {/* Año (solo en enero o primero) */}
                      {isYearStart && (
                        <text
                          x={x + 4}
                          y={14}
                          className="fill-muted-foreground text-[10px] font-semibold"
                        >
                          {m.getFullYear()}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* Líneas horizontales por fila */}
                {conFechas.map((_, idx) => {
                  const y = HEADER_HEIGHT + idx * ROW_HEIGHT
                  return (
                    <line
                      key={idx}
                      x1={0} y1={y}
                      x2={chartWidth} y2={y}
                      className="stroke-border/50"
                      strokeWidth={0.5}
                    />
                  )
                })}

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

                {/* Separador vertical entre labels y cronograma */}
                <line
                  x1={LABEL_WIDTH} y1={0}
                  x2={LABEL_WIDTH} y2={chartHeight}
                  className="stroke-border"
                  strokeWidth={1}
                />

                {/* Filas: label + barra */}
                {conFechas.map((p, idx) => {
                  const y = HEADER_HEIGHT + idx * ROW_HEIGHT
                  const rowCenterY = y + ROW_HEIGHT / 2
                  const { x, width } = barGeometry(p)
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
                        x={0} y={y}
                        width={chartWidth} height={ROW_HEIGHT}
                        className="fill-transparent hover:fill-muted/30 transition-colors"
                      />

                      {/* Label: nombre + cliente */}
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
