'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarRange, Wand2 } from 'lucide-react'

interface Props {
  proyectos: { id: number; nombre: string }[]
  presupuestos: { id: number; numero: string; total: number; proyecto: { nombre: string } | null }[]
  defaultProyectoId?: number
  defaultPresupuestoId?: number
}

export function NuevoCronogramaForm({ proyectos, presupuestos, defaultProyectoId, defaultPresupuestoId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generarDesdePresupuesto, setGenerarDesdePresupuesto] = useState(!!defaultPresupuestoId)
  const [duracionDefault, setDuracionDefault] = useState('3')

  const [form, setForm] = useState({
    nombre: '',
    proyectoId: defaultProyectoId ? String(defaultProyectoId) : '',
    presupuestoId: defaultPresupuestoId ? String(defaultPresupuestoId) : '',
    fechaInicio: new Date().toISOString().split('T')[0],
    estado: 'Planificado',
    notas: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Crear el cronograma
      const res = await fetch('/api/cronograma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          proyectoId: form.proyectoId || null,
          presupuestoId: form.presupuestoId || null,
          fechaInicio: form.fechaInicio,
          estado: form.estado,
          notas: form.notas,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al crear'); return }

      // 2. Si se eligió generar desde presupuesto, ejecutar
      if (generarDesdePresupuesto && form.presupuestoId) {
        const resGen = await fetch(`/api/cronograma/${data.id}/generar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presupuestoId: parseInt(form.presupuestoId),
            duracionDefault: parseInt(duracionDefault),
          }),
        })
        if (!resGen.ok) {
          const errData = await resGen.json()
          setError(errData.error || 'Error al generar actividades')
          return
        }
      }

      router.push(`/cronograma/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-blue-500" />
          Datos del cronograma
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="space-y-1">
            <Label>Nombre del cronograma *</Label>
            <Input
              value={form.nombre} required
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Cronograma remodelación cocina Apolo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Proyecto (opcional)</Label>
              <select value={form.proyectoId} onChange={e => setForm(p => ({ ...p, proyectoId: e.target.value }))}
                className="w-full h-10 border border-border rounded-md px-3 text-sm bg-background">
                <option value="">Sin proyecto</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={form.fechaInicio} required
                onChange={e => setForm(p => ({ ...p, fechaInicio: e.target.value }))} />
            </div>
          </div>

          {/* Generar desde presupuesto */}
          <div className="border border-border rounded-xl p-4 space-y-4 bg-muted/20">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={generarDesdePresupuesto}
                onChange={e => setGenerarDesdePresupuesto(e.target.checked)}
                className="w-4 h-4 rounded" />
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-foreground">Generar actividades desde un presupuesto</span>
              </div>
            </label>

            {generarDesdePresupuesto && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div className="space-y-1">
                  <Label className="text-xs">Presupuesto</Label>
                  <select value={form.presupuestoId} onChange={e => setForm(p => ({ ...p, presupuestoId: e.target.value }))}
                    className="w-full h-9 border border-border rounded-md px-3 text-sm bg-background">
                    <option value="">Seleccionar...</option>
                    {presupuestos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero}{p.proyecto ? ` — ${p.proyecto.nombre}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Días por defecto (sin rendimiento APU)</Label>
                  <Input type="number" min="1" max="365" value={duracionDefault}
                    onChange={e => setDuracionDefault(e.target.value)}
                    className="h-9 text-sm" />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Si la partida tiene rendimiento en el APU, la duración se calcula automáticamente: <strong>Cantidad ÷ Rendimiento</strong>.
                  Si no, se usa el valor por defecto.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
              rows={2} placeholder="Observaciones del cronograma..."
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando…' : generarDesdePresupuesto ? 'Crear y generar actividades' : 'Crear cronograma'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/cronograma')}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
