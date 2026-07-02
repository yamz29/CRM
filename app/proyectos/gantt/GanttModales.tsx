'use client'

import { useState } from 'react'
import { Flag, X, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  type Proyecto, type Hito, type TareaG, } from './gantt-utils'

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

export function HitoModal({ hito, proyectos, onClose, onSaved }: HitoModalProps) {
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
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  function handleDelete() {
    if (!hito) return
    setConfirmDelete(true)
  }

  async function confirmarEliminar() {
    if (!hito) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/hitos/${hito.id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
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

      <ConfirmDialog
        abierto={confirmDelete}
        titulo={`¿Eliminar el hito "${hito?.nombre ?? ''}"?`}
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={deleting}
        onConfirmar={confirmarEliminar}
        onCancelar={() => setConfirmDelete(false)}
      />
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

export function TareaModal({ tarea, proyectos, onClose, onSaved }: TareaModalProps) {
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
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  function handleDelete() {
    if (!tarea) return
    setConfirmDelete(true)
  }

  async function confirmarEliminar() {
    if (!tarea) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/tareas-gantt/${tarea.id}`, { method: 'DELETE' })
      if (res.ok) onSaved()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
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

      <ConfirmDialog
        abierto={confirmDelete}
        titulo={`¿Eliminar la tarea "${tarea?.nombre ?? ''}"?`}
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={deleting}
        onConfirmar={confirmarEliminar}
        onCancelar={() => setConfirmDelete(false)}
      />
    </div>
  )
}
