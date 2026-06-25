'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { X, CalendarRange } from 'lucide-react'

export interface CronogramaEditable {
  id: number
  nombre: string
  estado: string
  fechaInicio: string | Date
  fechaFinEstimado: string | Date | null
  proyectoId: number | null
  presupuestoId: number | null
  notas: string | null
}

interface Props {
  cronograma: CronogramaEditable
  proyectos: { id: number; nombre: string }[]
  presupuestos: { id: number; numero: string }[]
  onClose: () => void
}

const ESTADOS = ['Planificado', 'En Ejecución', 'Terminado', 'Pausado']

/** Fecha (UTC midnight) -> 'YYYY-MM-DD' para <input type="date">. */
function aInputDate(v: string | Date | null): string {
  if (!v) return ''
  const d = new Date(v)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function EditarCronogramaModal({ cronograma, proyectos, presupuestos, onClose }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: cronograma.nombre,
    estado: cronograma.estado,
    fechaInicio: aInputDate(cronograma.fechaInicio),
    fechaFinEstimado: aInputDate(cronograma.fechaFinEstimado),
    proyectoId: cronograma.proyectoId ? String(cronograma.proyectoId) : '',
    presupuestoId: cronograma.presupuestoId ? String(cronograma.presupuestoId) : '',
    notas: cronograma.notas ?? '',
  })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          estado: form.estado,
          fechaInicio: form.fechaInicio,
          fechaFinEstimado: form.fechaFinEstimado || null,
          proyectoId: form.proyectoId || null,
          presupuestoId: form.presupuestoId || null,
          notas: form.notas,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al guardar el cronograma')
        return
      }
      toast.exito('Cronograma actualizado')
      onClose()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-foreground">Editar cronograma</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={form.nombre} required onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Estado</Label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Proyecto</Label>
              <select value={form.proyectoId} onChange={e => setForm(p => ({ ...p, proyectoId: e.target.value }))}
                className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
                <option value="">Sin proyecto</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={form.fechaInicio} required onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Meta de entrega</Label>
              <Input type="date" value={form.fechaFinEstimado} onChange={e => setForm(p => ({ ...p, fechaFinEstimado: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Presupuesto</Label>
            <select value={form.presupuestoId} onChange={e => setForm(p => ({ ...p, presupuestoId: e.target.value }))}
              className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
              <option value="">Sin presupuesto</option>
              {presupuestos.map(p => <option key={p.id} value={p.id}>{p.numero}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Notas</Label>
            <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Guardando…' : 'Guardar cambios'}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
