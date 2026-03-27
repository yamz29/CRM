'use client'

import { useState, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Clock, FolderOpen, Sparkles, Archive,
  Truck, Users, Wrench, Trash2, Pencil, Check, X, Copy, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────

interface RegistroHoras {
  id: number
  usuarioId: number | null
  proyectoId: number | null
  fecha: string
  horas: number
  tipoActividad: string
  nota: string | null
  createdAt: string
  usuario: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string } | null
}

interface Props {
  registros: RegistroHoras[]
  proyectos: { id: number; nombre: string }[]
  usuarios:  { id: number; nombre: string }[]
}

// ── Constants ──────────────────────────────────────────────────────────

const TIPOS = [
  { label: 'Proyecto',     Icon: FolderOpen, bg: 'bg-blue-100',   border: 'border-blue-400',   text: 'text-blue-700',   bar: 'bg-blue-400'   },
  { label: 'Limpieza',     Icon: Sparkles,   bg: 'bg-green-100',  border: 'border-green-400',  text: 'text-green-700',  bar: 'bg-green-400'  },
  { label: 'Organización', Icon: Archive,    bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  { label: 'Transporte',   Icon: Truck,      bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700', bar: 'bg-purple-400' },
  { label: 'Reunión',      Icon: Users,      bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700', bar: 'bg-orange-400' },
  { label: 'Taller',       Icon: Wrench,     bg: 'bg-red-100',    border: 'border-red-400',    text: 'text-red-700',    bar: 'bg-red-400'    },
]

const HORAS_RAPIDAS = [0.5, 1, 2, 4, 8]

// ── Helpers ────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(dateStr: string) {
  // parse as local date to avoid off-by-one from UTC
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function shiftDate(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return date.toISOString().split('T')[0]
}

function tipoConf(label: string) {
  return TIPOS.find((t) => t.label === label) ?? TIPOS[0]
}

// ── Component ──────────────────────────────────────────────────────────

export function HorasPageClient({ registros: init, proyectos, usuarios }: Props) {
  const [registros, setRegistros] = useState<RegistroHoras[]>(init)
  const [tab, setTab] = useState<'registros' | 'reportes'>('registros')
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // Quick-add form
  const [tipo, setTipo]             = useState('')
  const [proyId, setProyId]         = useState('')
  const [horas, setHoras]           = useState(1)
  const [horasCustom, setHorasCustom] = useState('')
  const [nota, setNota]             = useState('')
  const [usrId, setUsrId]           = useState(usuarios[0]?.id?.toString() ?? '')
  const [saving, setSaving]         = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  // Inline edit
  const [editId, setEditId]   = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<RegistroHoras> & { horasStr?: string }>({})

  // Report period
  const [periodo, setPeriodo] = useState(30)

  // ── Derived ──────────────────────────────────────────────────────────

  const registrosDia = useMemo(
    () =>
      registros
        .filter((r) => r.fecha.slice(0, 10) === selectedDate)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [registros, selectedDate]
  )
  const totalDia = registrosDia.reduce((s, r) => s + r.horas, 0)

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
      .forEach((r) => {
        const k = r.proyecto!.nombre
        acc[k] = (acc[k] || 0) + r.horas
      })
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [registrosPeriodo])

  const horasPorActividad = useMemo(() => {
    const acc: Record<string, number> = {}
    registrosPeriodo.forEach((r) => {
      acc[r.tipoActividad] = (acc[r.tipoActividad] || 0) + r.horas
    })
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

  // ── Handlers ─────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!tipo) { alert('Selecciona un tipo de actividad'); return }
    if (tipo === 'Proyecto' && !proyId) { alert('Selecciona un proyecto'); return }
    const horasVal = horasCustom ? parseFloat(horasCustom) : horas
    if (!horasVal || horasVal <= 0) { alert('Ingresa las horas'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/horas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId:     usrId ? parseInt(usrId) : null,
          fecha:         selectedDate,
          horas:         horasVal,
          tipoActividad: tipo,
          proyectoId:    tipo === 'Proyecto' ? parseInt(proyId) : null,
          nota:          nota || null,
        }),
      })
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Error'); return }
      const nuevo: RegistroHoras = await res.json()
      setRegistros((prev) => [nuevo, ...prev])
      setNota(''); setHoras(1); setHorasCustom('')
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSave(id: number) {
    const horasVal = editData.horasStr ? parseFloat(editData.horasStr) : (editData.horas ?? 1)
    const res = await fetch(`/api/horas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioId:     editData.usuarioId,
        fecha:         editData.fecha?.slice(0, 10),
        horas:         horasVal,
        tipoActividad: editData.tipoActividad,
        proyectoId:    editData.proyectoId,
        nota:          editData.nota,
      }),
    })
    if (!res.ok) { alert('Error al actualizar'); return }
    const updated: RegistroHoras = await res.json()
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...updated, createdAt: r.createdAt } : r))
    )
    setEditId(null); setEditData({})
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este registro?')) return
    const res = await fetch(`/api/horas/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Error al eliminar'); return }
    setRegistros((prev) => prev.filter((r) => r.id !== id))
  }

  async function handleDuplicar() {
    const prevDay = shiftDate(selectedDate, -1)
    const source  = registros.filter((r) => r.fecha.slice(0, 10) === prevDay)
    if (source.length === 0) { alert('No hay registros del día anterior'); return }
    if (!confirm(`¿Duplicar ${source.length} registro(s) del día anterior a hoy?`)) return

    setDuplicating(true)
    try {
      const results = await Promise.all(
        source.map((r) =>
          fetch('/api/horas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuarioId:     r.usuarioId,
              fecha:         selectedDate,
              horas:         r.horas,
              tipoActividad: r.tipoActividad,
              proyectoId:    r.proyectoId,
              nota:          r.nota,
            }),
          }).then((res) => res.json())
        )
      )
      const nuevos = results.filter((r) => r.id) as RegistroHoras[]
      setRegistros((prev) => [...nuevos, ...prev])
    } finally {
      setDuplicating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit mb-6">
        {(['registros', 'reportes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            {t === 'registros' ? <><Clock className="w-3.5 h-3.5" /> Registros</> : <><BarChart3 className="w-3.5 h-3.5" /> Reportes</>}
          </button>
        ))}
      </div>

      {/* ── REGISTROS TAB ─────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">

          {/* Quick-add form */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-500" /> Registrar horas
            </h2>

            {/* Tipo actividad */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tipo de actividad</p>
              <div className="grid grid-cols-3 gap-1.5">
                {TIPOS.map(({ label, Icon, bg, border, text }) => (
                  <button
                    key={label}
                    onClick={() => { setTipo(label); if (label !== 'Proyecto') setProyId('') }}
                    className={cn(
                      'flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all',
                      tipo === label
                        ? `${bg} ${border} ${text} border-2`
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Proyecto */}
            {tipo === 'Proyecto' && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Proyecto</p>
                <select
                  value={proyId}
                  onChange={(e) => setProyId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Seleccionar proyecto —</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Persona */}
            {usuarios.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Persona</p>
                <select
                  value={usrId}
                  onChange={(e) => setUsrId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sin asignar —</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Horas rápidas */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Horas</p>
              <div className="flex gap-1.5 flex-wrap">
                {HORAS_RAPIDAS.map((h) => (
                  <button
                    key={h}
                    onClick={() => { setHoras(h); setHorasCustom('') }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-sm font-bold transition-all',
                      horas === h && !horasCustom
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950'
                    )}
                  >
                    {h === 0.5 ? '½' : h}h
                  </button>
                ))}
                <input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  placeholder="Otra"
                  value={horasCustom}
                  onChange={(e) => { setHorasCustom(e.target.value); if (e.target.value) setHoras(0) }}
                  className={cn(
                    'w-16 px-2 py-1.5 rounded-lg border text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500',
                    horasCustom
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                      : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                  )}
                />
              </div>
            </div>

            {/* Nota */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nota (opcional)</p>
              <input
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuardar()}
                placeholder="Descripción breve..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button
              onClick={handleGuardar}
              disabled={saving || !tipo || (tipo === 'Proyecto' && !proyId)}
              className="w-full"
            >
              {saving ? 'Guardando...' : '+ Guardar registro'}
            </Button>
          </div>

          {/* Day view */}
          <div>
            {/* Date navigator */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-500" />
              </button>
              <div className="flex-1 text-center">
                <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize text-sm">
                  {fmtDate(selectedDate)}
                </p>
                {selectedDate === todayStr() && (
                  <span className="text-xs text-blue-500 font-medium">Hoy</span>
                )}
              </div>
              <button
                onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
                disabled={selectedDate >= todayStr()}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </button>
              {selectedDate !== todayStr() && (
                <button
                  onClick={() => setSelectedDate(todayStr())}
                  className="text-xs text-blue-500 hover:underline px-2"
                >
                  Ir a hoy
                </button>
              )}
            </div>

            {/* Summary bar */}
            <div className="bg-card border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total del día</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums leading-none mt-0.5">
                    {totalDia % 1 === 0 ? totalDia : totalDia.toFixed(1)}h
                  </p>
                </div>
              </div>
              <button
                onClick={handleDuplicar}
                disabled={duplicating}
                title="Copiar los registros del día anterior a este día"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" />
                {duplicating ? 'Duplicando...' : 'Duplicar día anterior'}
              </button>
            </div>

            {/* List */}
            {registrosDia.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hay registros para este día</p>
                <p className="text-xs mt-1">Usa el formulario para agregar horas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {registrosDia.map((r) => {
                  const tc      = tipoConf(r.tipoActividad)
                  const isEdit  = editId === r.id

                  return (
                    <div key={r.id} className="bg-card border border-border rounded-xl p-4 transition-all">
                      {isEdit ? (
                        /* Inline edit */
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-1.5">
                            {TIPOS.map(({ label, Icon, bg, border, text }) => (
                              <button
                                key={label}
                                onClick={() =>
                                  setEditData((p) => ({
                                    ...p,
                                    tipoActividad: label,
                                    proyectoId: label !== 'Proyecto' ? null : p.proyectoId,
                                  }))
                                }
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium',
                                  editData.tipoActividad === label
                                    ? `${bg} ${border} ${text} border-2`
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                )}
                              >
                                <Icon className="w-3.5 h-3.5" /> {label}
                              </button>
                            ))}
                          </div>

                          {editData.tipoActividad === 'Proyecto' && (
                            <select
                              value={editData.proyectoId ?? ''}
                              onChange={(e) =>
                                setEditData((p) => ({
                                  ...p,
                                  proyectoId: e.target.value ? parseInt(e.target.value) : null,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
                            >
                              <option value="">— Proyecto —</option>
                              {proyectos.map((p) => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          )}

                          <div className="flex gap-3 items-center flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs text-slate-500">Horas:</label>
                              <input
                                type="number"
                                min="0.25"
                                step="0.25"
                                value={editData.horasStr ?? editData.horas ?? ''}
                                onChange={(e) =>
                                  setEditData((p) => ({ ...p, horasStr: e.target.value }))
                                }
                                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-sm text-center bg-white dark:bg-slate-800"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 flex-1">
                              <label className="text-xs text-slate-500">Nota:</label>
                              <input
                                type="text"
                                value={editData.nota ?? ''}
                                onChange={(e) =>
                                  setEditData((p) => ({ ...p, nota: e.target.value }))
                                }
                                placeholder="Nota..."
                                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-sm bg-white dark:bg-slate-800"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => { setEditId(null); setEditData({}) }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              <X className="w-3.5 h-3.5" /> Cancelar
                            </button>
                            <button
                              onClick={() => handleEditSave(r.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Check className="w-3.5 h-3.5" /> Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Row view */
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                              tc.bg,
                              tc.text
                            )}
                          >
                            <tc.Icon className="w-3 h-3" />
                            {r.tipoActividad}
                          </span>

                          <div className="flex-1 min-w-0">
                            {r.proyecto && (
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                {r.proyecto.nombre}
                              </p>
                            )}
                            {r.nota && (
                              <p className={cn('text-xs text-slate-400 italic truncate', r.proyecto && 'mt-0.5')}>
                                {r.nota}
                              </p>
                            )}
                          </div>

                          {r.usuario && (
                            <span className="text-xs text-slate-400 hidden md:block flex-shrink-0">
                              {r.usuario.nombre}
                            </span>
                          )}

                          <span className="font-bold text-slate-800 dark:text-white tabular-nums text-lg flex-shrink-0">
                            {r.horas % 1 === 0 ? r.horas : r.horas.toFixed(1)}h
                          </span>

                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditId(r.id)
                                setEditData({ ...r, horasStr: String(r.horas) })
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── REPORTES TAB ──────────────────────────────────────────────── */}
      {tab === 'reportes' && (
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500">Período:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriodo(d)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                  periodo === d
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                {d} días
              </button>
            ))}
            <span className="ml-auto text-sm text-slate-500">
              Total:{' '}
              <strong className="text-slate-800 dark:text-white">
                {totalPeriodo % 1 === 0 ? totalPeriodo : totalPeriodo.toFixed(1)}h
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Horas por proyecto */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 text-sm">
                <FolderOpen className="w-4 h-4 text-blue-500" /> Horas por proyecto
              </h3>
              {horasPorProyecto.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Sin registros de proyecto</p>
              ) : (
                <div className="space-y-3">
                  {horasPorProyecto.map(([nombre, h]) => (
                    <div key={nombre}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 dark:text-slate-300 truncate text-xs">{nombre}</span>
                        <span className="font-bold text-slate-800 dark:text-white ml-2 flex-shrink-0 tabular-nums">
                          {h % 1 === 0 ? h : h.toFixed(1)}h
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(h / (horasPorProyecto[0]?.[1] || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por tipo de actividad */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-purple-500" /> Por actividad
              </h3>
              {horasPorActividad.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Sin registros</p>
              ) : (
                <div className="space-y-3">
                  {horasPorActividad.map(([tipoLabel, h]) => {
                    const tc  = tipoConf(tipoLabel)
                    const pct = totalPeriodo > 0 ? (h / totalPeriodo) * 100 : 0
                    return (
                      <div key={tipoLabel}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={cn('flex items-center gap-1 text-xs font-medium', tc.text)}>
                            <tc.Icon className="w-3 h-3" /> {tipoLabel}
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {h % 1 === 0 ? h : h.toFixed(1)}h{' '}
                            <span className="text-slate-400">({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', tc.bar)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Horas por persona */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-green-500" /> Horas por persona
              </h3>
              {horasPorUsuario.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Sin registros</p>
              ) : (
                <div className="space-y-3">
                  {horasPorUsuario.map(([nombre, h]) => (
                    <div key={nombre}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 dark:text-slate-300 truncate text-xs">{nombre}</span>
                        <span className="font-bold text-slate-800 dark:text-white ml-2 flex-shrink-0 tabular-nums">
                          {h % 1 === 0 ? h : h.toFixed(1)}h
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${(h / (horasPorUsuario[0]?.[1] || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
