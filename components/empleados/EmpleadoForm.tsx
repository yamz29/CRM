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

interface HorarioData {
  dia: string
  horaEntrada?: number | null
  horaSalida?: number | null
  horasPorDia?: number | null
}

interface Props {
  mode: 'create' | 'edit'
  esAdmin: boolean
  usuarios?: { id: number; nombre: string }[]
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
    usuarioId?: number | null
    horarios?: HorarioData[]
    diasVacacionesAnual?: number
    banco?: string | null
    tipoCuenta?: string | null
    numeroCuenta?: string | null
    observaciones?: string | null
  }
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

type DiaForm = { activo: boolean; horaEntrada: string; horaSalida: string; horasPorDia: string }

function buildHorariosIniciales(horarios: HorarioData[] | undefined): Record<string, DiaForm> {
  const porDia = new Map((horarios || []).map((h) => [h.dia, h]))
  const result: Record<string, DiaForm> = {}
  for (const d of DIAS) {
    const h = porDia.get(d.value)
    const esLaborableDefault = !horarios && ['L', 'M', 'X', 'J', 'V'].includes(d.value)
    result[d.value] = {
      activo: h ? true : esLaborableDefault,
      horaEntrada: h?.horaEntrada != null ? String(h.horaEntrada) : '8',
      horaSalida: h?.horaSalida != null ? String(h.horaSalida) : '17',
      horasPorDia: h?.horasPorDia != null ? String(h.horasPorDia) : '8',
    }
  }
  return result
}

export function EmpleadoForm({ mode, esAdmin, usuarios, initialData }: Props) {
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
    usuarioId: initialData?.usuarioId != null ? String(initialData.usuarioId) : '',
    diasVacacionesAnual: initialData?.diasVacacionesAnual != null ? String(initialData.diasVacacionesAnual) : '14',
    banco: initialData?.banco || '',
    tipoCuenta: initialData?.tipoCuenta || '',
    numeroCuenta: initialData?.numeroCuenta || '',
    observaciones: initialData?.observaciones || '',
  })

  const [horariosPorDia, setHorariosPorDia] = useState<Record<string, DiaForm>>(
    () => buildHorariosIniciales(initialData?.horarios)
  )

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const toggleDia = (dia: string) => {
    setHorariosPorDia((prev) => ({ ...prev, [dia]: { ...prev[dia], activo: !prev[dia].activo } }))
  }

  const setDiaCampo = (dia: string, campo: keyof DiaForm, valor: string) => {
    setHorariosPorDia((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.fechaIngreso) { setError('La fecha de ingreso es obligatoria'); return }
    setLoading(true)
    setError(null)
    try {
      const horarios = DIAS
        .filter((d) => horariosPorDia[d.value].activo)
        .map((d) => ({
          dia: d.value,
          horaEntrada: horariosPorDia[d.value].horaEntrada,
          horaSalida: horariosPorDia[d.value].horaSalida,
          horasPorDia: horariosPorDia[d.value].horasPorDia,
        }))
      const res = await fetch(
        mode === 'create' ? '/api/empleados' : `/api/empleados/${initialData?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, horarios }),
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
        <p className="text-xs text-muted-foreground">
          Activa cada día laborable y ajusta su horario — viernes o sábado pueden tener horas distintas al resto.
        </p>
        <div className="space-y-2">
          {DIAS.map((d) => {
            const dia = horariosPorDia[d.value]
            return (
              <div key={d.value} className="flex items-center gap-3">
                <button type="button" onClick={() => toggleDia(d.value)}
                  className={`w-14 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors flex-shrink-0 ${
                    dia.activo
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}>
                  {d.label}
                </button>
                {dia.activo ? (
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <input type="number" value={dia.horaEntrada} onChange={(e) => setDiaCampo(d.value, 'horaEntrada', e.target.value)}
                      min="0" max="24" step="0.5" placeholder="Entrada"
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
                    <input type="number" value={dia.horaSalida} onChange={(e) => setDiaCampo(d.value, 'horaSalida', e.target.value)}
                      min="0" max="24" step="0.5" placeholder="Salida"
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
                    <input type="number" value={dia.horasPorDia} onChange={(e) => setDiaCampo(d.value, 'horasPorDia', e.target.value)}
                      min="0" max="24" step="0.5" placeholder="Horas"
                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground flex-1">No laborable</span>
                )}
              </div>
            )
          })}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Días de vacaciones por año</label>
          <input type="number" value={form.diasVacacionesAnual} onChange={(e) => set('diasVacacionesAnual', e.target.value)}
            min="0" step="1" placeholder="14"
            className="w-32 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-right" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Cuenta del sistema</h2>
        <p className="text-xs text-muted-foreground">
          Vincula este empleado a un usuario del sistema para sumar automáticamente las horas que registre en &quot;Horas del equipo&quot;.
        </p>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Usuario vinculado</label>
          <select value={form.usuarioId} onChange={(e) => set('usuarioId', e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card">
            <option value="">— Sin vincular —</option>
            {(usuarios || []).map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Datos bancarios</h2>
        <p className="text-xs text-muted-foreground">Se usan para generar la plantilla de pago de nómina.</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Banco</label>
            <input type="text" value={form.banco} onChange={(e) => set('banco', e.target.value)}
              placeholder="Ej: Banreservas"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo de cuenta</label>
            <select value={form.tipoCuenta} onChange={(e) => set('tipoCuenta', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card">
              <option value="">—</option>
              <option value="Ahorros">Ahorros</option>
              <option value="Corriente">Corriente</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Número de cuenta</label>
            <input type="text" value={form.numeroCuenta} onChange={(e) => set('numeroCuenta', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
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
