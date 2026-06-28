'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Plus, Check, X as XIcon, Trash2 } from 'lucide-react'

interface Solicitud {
  id: number
  tipo: string
  fechaInicio: string
  fechaFin: string
  dias: number
  motivo: string | null
  estado: string
}

const TIPOS = ['Vacaciones', 'Permiso', 'Licencia Médica', 'Otro']

const ESTADO_COLORS: Record<string, string> = {
  Solicitado: 'bg-amber-100 text-amber-700',
  Aprobado: 'bg-green-100 text-green-700',
  Rechazado: 'bg-red-100 text-red-700',
}

function diasEntre(inicio: string, fin: string) {
  const i = new Date(inicio)
  const f = new Date(fin)
  if (isNaN(i.getTime()) || isNaN(f.getTime())) return 0
  return Math.max(1, Math.round((f.getTime() - i.getTime()) / 86400000) + 1)
}

export function SolicitudesPanel({
  empleadoId,
  solicitudes,
  diasVacacionesAnual,
}: {
  empleadoId: number
  solicitudes: Solicitud[]
  diasVacacionesAnual: number
}) {
  const router = useRouter()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ tipo: 'Vacaciones', fechaInicio: '', fechaFin: '', motivo: '' })

  const anioActual = new Date().getFullYear()
  const diasUsados = solicitudes
    .filter((s) => s.tipo === 'Vacaciones' && s.estado === 'Aprobado' && new Date(s.fechaInicio).getFullYear() === anioActual)
    .reduce((sum, s) => sum + s.dias, 0)
  const saldoDisponible = Math.max(0, diasVacacionesAnual - diasUsados)

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }))

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fechaInicio || !form.fechaFin) { toast.error('Fechas obligatorias'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/empleados/${empleadoId}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, dias: diasEntre(form.fechaInicio, form.fechaFin) }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      toast.exito('Solicitud creada')
      setShowForm(false)
      setForm({ tipo: 'Vacaciones', fechaInicio: '', fechaFin: '', motivo: '' })
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const cambiarEstado = async (id: number, estado: string) => {
    try {
      const res = await fetch(`/api/empleados/${empleadoId}/solicitudes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      toast.exito(estado === 'Aprobado' ? 'Solicitud aprobada' : 'Solicitud rechazada')
      router.refresh()
    } catch {
      toast.error('Error al actualizar la solicitud')
    }
  }

  const eliminar = async (id: number) => {
    try {
      const res = await fetch(`/api/empleados/${empleadoId}/solicitudes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      toast.exito('Solicitud eliminada')
      router.refresh()
    } catch {
      toast.error('Error al eliminar la solicitud')
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Vacaciones y permisos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Saldo de vacaciones {anioActual}: <span className="font-semibold text-foreground">{saldoDisponible}</span> de {diasVacacionesAnual} días
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" /> Nueva solicitud
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCrear} className="p-4 border-b border-border bg-muted/30 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card">
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Desde</label>
            <input type="date" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Hasta</label>
            <input type="date" value={form.fechaFin} onChange={(e) => set('fechaFin', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-foreground mb-1">Motivo</label>
            <input type="text" value={form.motivo} onChange={(e) => set('motivo', e.target.value)}
              placeholder="Opcional"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      )}

      <div className="divide-y divide-border">
        {solicitudes.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">Sin solicitudes registradas</p>
        )}
        {solicitudes.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm">{s.tipo}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[s.estado] || ''}`}>{s.estado}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(s.fechaInicio)} – {formatDate(s.fechaFin)} · {s.dias} día{s.dias !== 1 ? 's' : ''}
                {s.motivo && ` · ${s.motivo}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {s.estado === 'Solicitado' && (
                <>
                  <button onClick={() => cambiarEstado(s.id, 'Aprobado')}
                    className="p-1.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors" aria-label="Aprobar" title="Aprobar">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => cambiarEstado(s.id, 'Rechazado')}
                    className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Rechazar" title="Rechazar">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => eliminar(s.id)}
                className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Eliminar" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
