'use client'

import { useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Clock, FolderOpen, Sparkles, Archive,
  Truck, Users, Wrench, Trash2, Pencil, X, BarChart3, Plus,
  Search, FileText, DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────

interface RegistroHoras {
  id: number
  usuarioId: number | null
  proyectoId: number | null
  clienteId: number | null
  fecha: string
  horas: number
  tipoActividad: string
  nota: string | null
  horaInicio: number | null
  createdAt: string
  usuario: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string } | null
  cliente:  { id: number; nombre: string } | null
}

interface Props {
  registros:     RegistroHoras[]
  proyectos:     { id: number; nombre: string }[]
  usuarios:      { id: number; nombre: string }[]
  clientes:      { id: number; nombre: string }[]
  currentUserId: number | null
}

// ── Constants ──────────────────────────────────────────────────────────

const HOUR_START = 7
const HOUR_END   = 19  // exclusive → 7am … 6pm
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const TOTAL_H    = HOUR_END - HOUR_START

const TIPOS = [
  // Producción
  { label: 'Proyecto',      Icon: FolderOpen, bg: 'bg-blue-500',    text: 'text-white', light: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-400',    grupo: 'Producción'  },
  // Comercial
  { label: 'Prospección',   Icon: Search,     bg: 'bg-teal-500',    text: 'text-white', light: 'bg-teal-100 text-teal-700',    bar: 'bg-teal-400',    grupo: 'Comercial'   },
  { label: 'Levantamiento', Icon: FileText,   bg: 'bg-cyan-500',    text: 'text-white', light: 'bg-cyan-100 text-cyan-700',    bar: 'bg-cyan-400',    grupo: 'Comercial'   },
  { label: 'Cotización',    Icon: DollarSign, bg: 'bg-indigo-500',  text: 'text-white', light: 'bg-indigo-100 text-indigo-700',bar: 'bg-indigo-400',  grupo: 'Comercial'   },
  // Operativo
  { label: 'Reunión',       Icon: Users,      bg: 'bg-orange-500',  text: 'text-white', light: 'bg-orange-100 text-orange-700',bar: 'bg-orange-400',  grupo: 'Operativo'   },
  { label: 'Transporte',    Icon: Truck,      bg: 'bg-purple-500',  text: 'text-white', light: 'bg-purple-100 text-purple-700',bar: 'bg-purple-400',  grupo: 'Operativo'   },
  { label: 'Organización',  Icon: Archive,    bg: 'bg-yellow-500',  text: 'text-white', light: 'bg-yellow-100 text-yellow-700',bar: 'bg-yellow-400',  grupo: 'Operativo'   },
  { label: 'Limpieza',      Icon: Sparkles,   bg: 'bg-green-500',   text: 'text-white', light: 'bg-green-100 text-green-700',  bar: 'bg-green-400',   grupo: 'Operativo'   },
  { label: 'Taller',        Icon: Wrench,     bg: 'bg-red-500',     text: 'text-white', light: 'bg-red-100 text-red-700',      bar: 'bg-red-400',     grupo: 'Operativo'   },
]

const TIPOS_COMERCIAL = ['Prospección', 'Levantamiento', 'Cotización']

// ── Helpers ────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0] }

function shiftDate(d: string, days: number) {
  const [y, m, dd] = d.split('-').map(Number)
  const date = new Date(y, m - 1, dd + days)
  return date.toISOString().split('T')[0]
}

function getMondayOf(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day  = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return shiftDate(dateStr, diff)
}

function getWeekDates(mondayStr: string) {
  return Array.from({ length: 7 }, (_, i) => shiftDate(mondayStr, i))
}

function fmtDayShort(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    weekday: date.toLocaleDateString('es-DO', { weekday: 'short' }),
    day:     date.getDate(),
    month:   date.toLocaleDateString('es-DO', { month: 'short' }),
  }
}

function fmtWeekRange(mondayStr: string) {
  const sunday = shiftDate(mondayStr, 6)
  const [y1, m1, d1] = mondayStr.split('-').map(Number)
  const [, m2, d2]   = sunday.split('-').map(Number)
  const mo1 = new Date(y1, m1 - 1, d1).toLocaleDateString('es-DO', { month: 'short' })
  const mo2 = new Date(y1, m2 - 1, d2).toLocaleDateString('es-DO', { month: 'short' })
  return m1 === m2
    ? `${d1} – ${d2} ${mo1} ${y1}`
    : `${d1} ${mo1} – ${d2} ${mo2} ${y1}`
}

function tc(label: string) { return TIPOS.find((t) => t.label === label) ?? TIPOS[0] }

function fmtH(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return mm ? `${hh}:${String(mm).padStart(2, '0')}` : `${hh}:00`
}

// ── Sub-component: Block popup (create / edit) ─────────────────────────

const GRUPOS_TIPOS = [
  { grupo: 'Producción', tipos: TIPOS.filter((t) => t.grupo === 'Producción') },
  { grupo: 'Comercial',  tipos: TIPOS.filter((t) => t.grupo === 'Comercial')  },
  { grupo: 'Operativo',  tipos: TIPOS.filter((t) => t.grupo === 'Operativo')  },
]

interface PopupState {
  mode: 'create' | 'edit'
  registro?: RegistroHoras
  usuarioId: number | null
  date: string
  horaInicio: number
  horas: number
  tipo: string
  proyectoId: string
  clienteId: string
  nota: string
}

function BlockPopup({
  state,
  proyectos,
  clientes,
  onSave,
  onDelete,
  onClose,
}: {
  state: PopupState
  proyectos: { id: number; nombre: string }[]
  clientes:  { id: number; nombre: string }[]
  onSave: (data: Omit<PopupState, 'mode' | 'registro'>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [tipo,       setTipo]       = useState(state.tipo)
  const [proyectoId, setProyectoId] = useState(state.proyectoId)
  const [clienteId,  setClienteId]  = useState(state.clienteId)
  const [horas,      setHoras]      = useState(state.horas)
  const [nota,       setNota]       = useState(state.nota)
  const [horaInicio, setHoraInicio] = useState(state.horaInicio)
  const [saving,     setSaving]     = useState(false)

  const horaFin      = Math.min(horaInicio + horas, HOUR_END)
  const esComercial  = TIPOS_COMERCIAL.includes(tipo)

  async function handleSave() {
    if (!tipo) return
    if (tipo === 'Proyecto' && !proyectoId) return
    setSaving(true)
    try {
      await onSave({ usuarioId: state.usuarioId, date: state.date, horaInicio, horas, tipo, proyectoId, clienteId, nota })
    } finally {
      setSaving(false)
    }
  }

  const durOptions = [1, 2, 3, 4, 6, 8]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4 max-h-[90vh] overflow-y-auto border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground text-sm">
              {state.mode === 'create' ? 'Agregar bloque' : 'Editar bloque'}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtDayShort(state.date).weekday} {fmtDayShort(state.date).day}{' '}
              {fmtDayShort(state.date).month} · {fmtH(horaInicio)}–{fmtH(horaFin)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hora inicio */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hora inicio</p>
          <div className="flex gap-1.5 flex-wrap">
            {HOURS.map((h) => (
              <button
                key={h}
                onClick={() => setHoraInicio(h)}
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-medium border transition-all',
                  horaInicio === h
                    ? 'bg-foreground border-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                )}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Duración */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Duración</p>
          <div className="flex gap-1.5">
            {durOptions.map((h) => (
              <button
                key={h}
                onClick={() => setHoras(h)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-bold border transition-all',
                  horas === h
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5'
                )}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        {/* Tipo agrupado */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Actividad</p>
          <div className="space-y-2">
            {GRUPOS_TIPOS.map(({ grupo, tipos }) => (
              <div key={grupo}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{grupo}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tipos.map(({ label, Icon, bg, text }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setTipo(label)
                        if (label !== 'Proyecto') setProyectoId('')
                        if (!TIPOS_COMERCIAL.includes(label)) setClienteId('')
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 transition-all',
                        tipo === label
                          ? `${bg} ${text} border-transparent`
                          : 'border-border text-muted-foreground hover:border-muted-foreground bg-card'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Proyecto (solo si tipo = Proyecto) */}
        {tipo === 'Proyecto' && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Proyecto *</p>
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Seleccionar —</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cliente (solo si tipo es Comercial) */}
        {esComercial && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Cliente (opcional)</p>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— Sin cliente específico —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Nota */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Nota (opcional)</p>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Descripción breve..."
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {state.mode === 'edit' && onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !tipo || (tipo === 'Proyecto' && !proyectoId)}
            className="flex-1 px-3 py-2 text-sm rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function HorasPageClient({ registros: init, proyectos, usuarios, clientes, currentUserId }: Props) {
  const [registros, setRegistros] = useState<RegistroHoras[]>(init)
  const [tab, setTab]             = useState<'grid' | 'reportes'>('grid')
  const [monday, setMonday]       = useState(getMondayOf(todayStr()))
  const [filterUsr, setFilterUsr] = useState(currentUserId ? String(currentUserId) : '')

  const [popup,     setPopup]     = useState<PopupState | null>(null)

  // ── Derived ────────────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(monday), [monday])

  // Build employee groups for the grid
  const groups = useMemo(() => {
    const targetUsers = filterUsr
      ? usuarios.filter((u) => String(u.id) === filterUsr)
      : usuarios.length > 0
        ? usuarios
        : [{ id: -1, nombre: 'Equipo' }]

    return targetUsers.map((u) => ({
      usuarioId: u.id === -1 ? null : u.id,
      nombre:    u.nombre,
      registros: registros.filter(
        (r) => (u.id === -1 ? true : r.usuarioId === u.id)
      ),
    }))
  }, [registros, usuarios, filterUsr])

  // ── Handlers ──────────────────────────────────────────────────────

  function openCreate(usuarioId: number | null, date: string, horaInicio: number) {
    setPopup({
      mode: 'create',
      usuarioId,
      date,
      horaInicio,
      horas: 2,
      tipo: '',
      proyectoId: '',
      clienteId: '',
      nota: '',
    })
  }

  function openEdit(r: RegistroHoras) {
    setPopup({
      mode: 'edit',
      registro: r,
      usuarioId: r.usuarioId,
      date: r.fecha.slice(0, 10),
      horaInicio: r.horaInicio ?? HOUR_START,
      horas: r.horas,
      tipo: r.tipoActividad,
      proyectoId: r.proyectoId ? String(r.proyectoId) : '',
      clienteId:  r.clienteId  ? String(r.clienteId)  : '',
      nota: r.nota ?? '',
    })
  }

  async function handleSave(data: Omit<PopupState, 'mode' | 'registro'>) {
    const isEdit = popup?.mode === 'edit'
    const url    = isEdit ? `/api/horas/${popup!.registro!.id}` : '/api/horas'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId:     data.usuarioId,
        fecha:         data.date,
        horas:         data.horas,
        tipoActividad: data.tipo,
        proyectoId:    data.tipo === 'Proyecto' ? (data.proyectoId ? parseInt(data.proyectoId) : null) : null,
        clienteId:     TIPOS_COMERCIAL.includes(data.tipo) ? (data.clienteId ? parseInt(data.clienteId) : null) : null,
        nota:          data.nota || null,
        horaInicio:    data.horaInicio,
      }),
    })
    if (!res.ok) { alert('Error al guardar'); return }
    const saved: RegistroHoras = await res.json()

    if (isEdit) {
      setRegistros((prev) =>
        prev.map((r) => (r.id === saved.id ? { ...saved, createdAt: r.createdAt } : r))
      )
    } else {
      setRegistros((prev) => [saved, ...prev])
    }
    setPopup(null)
  }

  async function handleDelete() {
    if (!popup?.registro) return
    if (!confirm('¿Eliminar este bloque?')) return
    const res = await fetch(`/api/horas/${popup.registro.id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Error al eliminar'); return }
    setRegistros((prev) => prev.filter((r) => r.id !== popup.registro!.id))
    setPopup(null)
  }

  // ── Report data ────────────────────────────────────────────────────

  const [periodo, setPeriodo] = useState(30)

  const registrosPeriodo = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodo)
    return registros.filter((r) => new Date(r.fecha) >= cutoff)
  }, [registros, periodo])

  const totalPeriodo = registrosPeriodo.reduce((s, r) => s + r.horas, 0)

  const horasPorProyecto = useMemo(() => {
    const acc: Record<string, number> = {}
    registrosPeriodo
      .filter((r) => r.tipoActividad === 'Proyecto' && r.proyecto)
      .forEach((r) => { const k = r.proyecto!.nombre; acc[k] = (acc[k] || 0) + r.horas })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [registrosPeriodo])

  const horasPorActividad = useMemo(() => {
    const acc: Record<string, number> = {}
    registrosPeriodo.forEach((r) => { acc[r.tipoActividad] = (acc[r.tipoActividad] || 0) + r.horas })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [registrosPeriodo])

  const horasPorUsuario = useMemo(() => {
    const acc: Record<string, number> = {}
    registrosPeriodo.forEach((r) => {
      const k = r.usuario?.nombre ?? 'Sin asignar'
      acc[k] = (acc[k] || 0) + r.horas
    })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [registrosPeriodo])

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-6">
        {(['grid', 'reportes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'grid'
              ? <><Clock className="w-3.5 h-3.5" /> Horario</>
              : <><BarChart3 className="w-3.5 h-3.5" /> Reportes</>}
          </button>
        ))}
      </div>

      {/* ── GRID TAB ──────────────────────────────────────────────── */}
      {tab === 'grid' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Week nav */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <button
                onClick={() => setMonday(shiftDate(monday, -7))}
                className="p-1 rounded-lg hover:bg-muted"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-medium text-foreground min-w-[160px] text-center">
                {fmtWeekRange(monday)}
              </span>
              <button
                onClick={() => setMonday(shiftDate(monday, 7))}
                className="p-1 rounded-lg hover:bg-muted"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Today button */}
            {monday !== getMondayOf(todayStr()) && (
              <button
                onClick={() => setMonday(getMondayOf(todayStr()))}
                className="px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
              >
                Esta semana
              </button>
            )}

            {/* Employee filter */}
            {usuarios.length > 1 && (
              <select
                value={filterUsr}
                onChange={(e) => setFilterUsr(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-xl bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los empleados</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            )}

            <p className="text-xs text-muted-foreground ml-auto hidden md:block">
              Clic en una celda para agregar un bloque
            </p>
          </div>

          {/* Grid */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div style={{ minWidth: '900px' }}>

                {/* Hour header */}
                <div className="flex border-b border-border bg-muted/40">
                  <div className="w-40 flex-shrink-0 border-r border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Empleado
                  </div>
                  <div className="w-28 flex-shrink-0 border-r border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Fecha
                  </div>
                  <div className="flex flex-1">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="flex-1 text-center py-2.5 text-xs font-medium text-muted-foreground border-r border-border last:border-r-0"
                      >
                        {h}h
                      </div>
                    ))}
                  </div>
                </div>

                {/* Employee groups */}
                {groups.map((group, gi) => (
                  <div key={group.usuarioId ?? 'all'}>
                    {/* Date rows */}
                    {weekDates.map((date, di) => {
                      const isToday  = date === todayStr()
                      const dayRegs  = group.registros.filter(
                        (r) => r.fecha.slice(0, 10) === date && r.horaInicio != null
                      )
                      const { weekday, day, month } = fmtDayShort(date)
                      const isLastRow =
                        gi === groups.length - 1 && di === weekDates.length - 1

                      return (
                        <div
                          key={date}
                          className={cn(
                            'flex border-b border-border',
                            isLastRow && 'border-b-0',
                            isToday && 'bg-blue-50/40 dark:bg-blue-950/20'
                          )}
                        >
                          {/* Employee name — only on first day of group */}
                          <div className="w-40 flex-shrink-0 border-r border-border px-3 py-3 flex items-center">
                            {di === 0 ? (
                              <span className="text-sm font-semibold text-foreground">
                                {group.nombre}
                              </span>
                            ) : null}
                          </div>

                          {/* Date */}
                          <div
                            className={cn(
                              'w-28 flex-shrink-0 border-r border-border px-3 py-3 flex flex-col justify-center',
                              isToday && 'font-semibold'
                            )}
                          >
                            <span className="text-xs text-muted-foreground capitalize">{weekday}</span>
                            <span className={cn('text-sm', isToday ? 'text-blue-600 font-bold' : 'text-foreground')}>
                              {day} {month}
                            </span>
                            {isToday && (
                              <span className="text-xs text-blue-500 font-medium">Hoy</span>
                            )}
                          </div>

                          {/* Hour cells + blocks */}
                          <div className="flex-1 relative" style={{ height: '52px' }}>
                            {/* Clickable cells */}
                            <div className="absolute inset-0 flex">
                              {HOURS.map((h) => {
                                const occupied = dayRegs.some(
                                  (r) =>
                                    r.horaInicio! <= h &&
                                    h < r.horaInicio! + r.horas
                                )
                                return (
                                  <div
                                    key={h}
                                    onClick={() => !occupied && openCreate(group.usuarioId, date, h)}
                                    className={cn(
                                      'flex-1 border-r border-border/50 last:border-r-0 transition-colors',
                                      occupied
                                        ? 'cursor-default'
                                        : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 group'
                                    )}
                                  >
                                    {!occupied && (
                                      <div className="hidden group-hover:flex items-center justify-center h-full">
                                        <Plus className="w-3 h-3 text-blue-400" />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Blocks */}
                            {dayRegs.map((r) => {
                              const cfg   = tc(r.tipoActividad)
                              const left  = ((r.horaInicio! - HOUR_START) / TOTAL_H) * 100
                              const width = Math.min(
                                (r.horas / TOTAL_H) * 100,
                                100 - left
                              )
                              const label = r.proyecto?.nombre || r.cliente?.nombre || (r.nota ? r.nota : r.tipoActividad)

                              return (
                                <div
                                  key={r.id}
                                  onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                                  style={{
                                    position: 'absolute',
                                    left:   `${left}%`,
                                    width:  `${width}%`,
                                    top:    '5px',
                                    bottom: '5px',
                                  }}
                                  className={cn(
                                    'rounded-lg px-2 flex items-center gap-1 text-xs font-semibold cursor-pointer shadow-sm overflow-hidden',
                                    'hover:brightness-110 transition-all z-10',
                                    cfg.bg,
                                    cfg.text
                                  )}
                                  title={`${r.tipoActividad}${r.proyecto ? ` · ${r.proyecto.nombre}` : ''}${r.cliente ? ` · ${r.cliente.nombre}` : ''}${r.nota ? ` · ${r.nota}` : ''} | ${r.horas}h`}
                                >
                                  <cfg.Icon className="w-3 h-3 flex-shrink-0 opacity-80" />
                                  <span className="truncate">{label}</span>
                                  <span className="ml-auto flex-shrink-0 opacity-75 text-[10px]">{r.horas}h</span>
                                  <Pencil className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 pt-1">
            {TIPOS.map(({ label, Icon, bg, text }) => (
              <span key={label} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
                <Icon className="w-3 h-3" /> {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── REPORTES TAB ────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Período:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriodo(d)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                  periodo === d
                    ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {d} días
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">
              Total: <strong className="text-foreground">
                {totalPeriodo % 1 === 0 ? totalPeriodo : totalPeriodo.toFixed(1)}h
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Por proyecto */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
                <FolderOpen className="w-4 h-4 text-blue-500" /> Horas por proyecto
              </h3>
              {horasPorProyecto.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">Sin registros</p>
                : <div className="space-y-3">
                    {horasPorProyecto.map(([nombre, h]) => (
                      <div key={nombre}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground truncate">{nombre}</span>
                          <span className="font-bold ml-2 tabular-nums">{h % 1 === 0 ? h : h.toFixed(1)}h</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(h / (horasPorProyecto[0]?.[1] || 1)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Por actividad */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-purple-500" /> Por tipo de actividad
              </h3>
              {horasPorActividad.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">Sin registros</p>
                : <div className="space-y-3">
                    {horasPorActividad.map(([tipoLabel, h]) => {
                      const cfg = tc(tipoLabel)
                      const pct = totalPeriodo > 0 ? (h / totalPeriodo) * 100 : 0
                      return (
                        <div key={tipoLabel}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={cn('flex items-center gap-1 text-xs font-medium', cfg.light.split(' ')[1])}>
                              <cfg.Icon className="w-3 h-3" /> {tipoLabel}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {h % 1 === 0 ? h : h.toFixed(1)}h <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', cfg.bar)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>

            {/* Por persona */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-green-500" /> Horas por persona
              </h3>
              {horasPorUsuario.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">Sin registros</p>
                : <div className="space-y-3">
                    {horasPorUsuario.map(([nombre, h]) => (
                      <div key={nombre}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground truncate">{nombre}</span>
                          <span className="font-bold ml-2 tabular-nums">{h % 1 === 0 ? h : h.toFixed(1)}h</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${(h / (horasPorUsuario[0]?.[1] || 1)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      )}

      {/* Block popup (create / edit) */}
      {popup && (
        <BlockPopup
          state={popup}
          proyectos={proyectos}
          clientes={clientes}
          onSave={handleSave}
          onDelete={popup.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}
