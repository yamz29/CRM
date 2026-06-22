'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'

const DIAS = [
  { value: 'L', label: 'Lun' },
  { value: 'M', label: 'Mar' },
  { value: 'X', label: 'Mié' },
  { value: 'J', label: 'Jue' },
  { value: 'V', label: 'Vie' },
  { value: 'S', label: 'Sáb' },
  { value: 'D', label: 'Dom' },
]

interface Props {
  mode: 'create' | 'edit'
  esAdmin: boolean
  initialData?: {
    id?: number
    nombre?: string
    cedula?: string | null
    telefono?: string | null
    correo?: string | null
    cargo?: string | null
    departamento?: string | null
    fechaIngreso?: string
    fechaSalida?: string | null
    activo?: boolean
    salario?: number | null
    horaEntrada?: number | null
    horaSalida?: number | null
    horasPorDia?: number | null
    diasLaborables?: string | null
    diasVacacionesAnual?: number
    observaciones?: string | null
  }
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

export function EmpleadoForm({ mode, esAdmin, initialData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre: initialData?.nombre || '',
    cedula: initialData?.cedula || '',
    telefono: initialData?.telefono || '',
    correo: initialData?.correo || '',
    cargo: initialData?.cargo || '',
    departamento: initialData?.departamento || '',
    fechaIngreso: toDateInput(initialData?.fechaIngreso) || new Date().toISOString().slice(0, 10),
    fechaSalida: toDateInput(initialData?.fechaSalida),
    activo: initialData?.activo !== false,
    salario: initialData?.salario != null ? String(initialData.salario) : '',
    horaEntrada: initialData?.horaEntrada != null ? String(initialData.horaEntrada) : '8',
    horaSalida: initialData?.horaSalida != null ? String(initialData.horaSalida) : '17',
    horasPorDia: initialData?.horasPorDia != null ? String(initialData.horasPorDia) : '8',
    diasLaborables: initialData?.diasLaborables || 'L,M,X,J,V',
    diasVacacionesAnual: initialData?.diasVacacionesAnual != null ? String(initialData.diasVacacionesAnual) : '14',
    observaciones: initialData?.observaciones || '',
  })

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const diasSeleccionados = form.diasLaborables.split(',').filter(Boolean)
  const toggleDia = (dia: string) => {
    const set2 = new Set(diasSeleccionados)
    if (set2.has(dia)) set2.delete(dia)
    else set2.add(dia)
    set('diasLaborables', DIAS.filter((d) => set2.has(d.value)).map((d) => d.value).join(','))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.fechaIngreso) { setError('La fecha de ingreso es obligatoria'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        mode === 'create' ? '/api/empleados' : `/api/empleados/${initialData?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      router.push(mode === 'create' ? '/empleados?msg=creado' : '/empleados?msg=actualizado')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Datos personales</h2>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Nombre <span className="text-red-500">*</span></label>
          <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
            placeholder="Nombre completo"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cédula</label>
            <input type="text" value={form.cedula} onChange={(e) => set('cedula', e.target.value)}
              placeholder="000-0000000-0"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Teléfono</label>
            <input type="text" value={form.telefono} onChange={(e) => set('telefono', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Correo</label>
          <input type="email" value={form.correo} onChange={(e) => set('correo', e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cargo</label>
            <input type="text" value={form.cargo} onChange={(e) => set('cargo', e.target.value)}
              placeholder="Ej: Carpintero"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Departamento</label>
            <input type="text" value={form.departamento} onChange={(e) => set('departamento', e.target.value)}
              placeholder="Ej: Taller"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Relación laboral</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha de ingreso <span className="text-red-500">*</span></label>
            <input type="date" value={form.fechaIngreso} onChange={(e) => set('fechaIngreso', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Fecha de salida</label>
            <input type="date" value={form.fechaSalida} onChange={(e) => set('fechaSalida', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        {esAdmin && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Salario (RD$) <span className="text-xs text-muted-foreground">— solo visible para Admin</span></label>
            <input type="number" value={form.salario} onChange={(e) => set('salario', e.target.value)}
              min="0" step="0.01" placeholder="0"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="activo" checked={form.activo} onChange={(e) => set('activo', e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-ring" />
          <label htmlFor="activo" className="text-sm font-medium text-foreground">Empleado activo</label>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Horario contractual</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora entrada</label>
            <input type="number" value={form.horaEntrada} onChange={(e) => set('horaEntrada', e.target.value)}
              min="0" max="24" step="0.5" placeholder="8.0"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora salida</label>
            <input type="number" value={form.horaSalida} onChange={(e) => set('horaSalida', e.target.value)}
              min="0" max="24" step="0.5" placeholder="17.0"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Horas/día</label>
            <input type="number" value={form.horasPorDia} onChange={(e) => set('horasPorDia', e.target.value)}
              min="0" max="24" step="0.5" placeholder="8"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Días laborables</label>
          <div className="flex gap-1.5">
            {DIAS.map((d) => (
              <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  diasSeleccionados.includes(d.value)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Días de vacaciones por año</label>
          <input type="number" value={form.diasVacacionesAnual} onChange={(e) => set('diasVacacionesAnual', e.target.value)}
            min="0" step="1" placeholder="14"
            className="w-32 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Notas</h2>
        <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)}
          rows={3} placeholder="Observaciones adicionales..."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push('/empleados')} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : <><Save className="w-4 h-4" />{mode === 'create' ? 'Crear Empleado' : 'Guardar Cambios'}</>}
        </Button>
      </div>
    </form>
  )
}
