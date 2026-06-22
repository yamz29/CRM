'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'

function quincenaSugerida() {
  const hoy = new Date()
  const dia = hoy.getDate()
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  if (dia <= 15) {
    return {
      inicio: new Date(anio, mes, 1).toISOString().slice(0, 10),
      fin: new Date(anio, mes, 15).toISOString().slice(0, 10),
    }
  }
  const ultimoDia = new Date(anio, mes + 1, 0).getDate()
  return {
    inicio: new Date(anio, mes, 16).toISOString().slice(0, 10),
    fin: new Date(anio, mes, ultimoDia).toISOString().slice(0, 10),
  }
}

export function PeriodoForm() {
  const router = useRouter()
  const sugerida = quincenaSugerida()
  const [fechaInicio, setFechaInicio] = useState(sugerida.inicio)
  const [fechaFin, setFechaFin] = useState(sugerida.fin)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nomina/periodos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaInicio, fechaFin }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      router.push('/nomina?msg=creado')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Quincena</h2>
        <p className="text-xs text-muted-foreground">
          Se generará automáticamente una línea de pago por cada empleado activo con salario asignado.
          Las horas extra y bonificaciones se ajustan después, por empleado.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Desde</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hasta</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push('/nomina')}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          <Save className="w-4 h-4" /> {loading ? 'Creando...' : 'Crear período'}
        </Button>
      </div>
    </form>
  )
}
