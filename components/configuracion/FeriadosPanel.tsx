'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDays, Plus, Trash2, Download, Loader2, AlertCircle } from 'lucide-react'

interface Feriado {
  id: number
  fecha: string  // YYYY-MM-DD
  nombre: string
  recurrente: boolean
}

interface Props {
  initialData: Feriado[]
}

export function FeriadosPanel({ initialData }: Props) {
  const router = useRouter()
  const [feriados, setFeriados] = useState(initialData)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Agrupar por año
  const porAnio: Record<string, Feriado[]> = {}
  for (const f of feriados) {
    const y = f.fecha.slice(0, 4)
    if (!porAnio[y]) porAnio[y] = []
    porAnio[y].push(f)
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevaFecha || !nuevoNombre.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/configuracion/feriados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: nuevaFecha,
          nombre: nuevoNombre.trim(),
          recurrente: false,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Error al guardar')
        return
      }
      const creado = await res.json()
      setFeriados(prev => {
        const f: Feriado = {
          id: creado.id,
          fecha: nuevaFecha,
          nombre: creado.nombre,
          recurrente: creado.recurrente,
        }
        // Reemplaza si ya existía por upsert
        const sin = prev.filter(x => x.fecha !== nuevaFecha)
        return [...sin, f].sort((a, b) => a.fecha.localeCompare(b.fecha))
      })
      setNuevaFecha('')
      setNuevoNombre('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(id: number) {
    if (!confirm('¿Eliminar este feriado?')) return
    try {
      const res = await fetch(`/api/configuracion/feriados/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setFeriados(prev => prev.filter(f => f.id !== id))
        router.refresh()
      }
    } catch { /* noop */ }
  }

  async function seedOficiales() {
    setSeeding(true)
    setError(null)
    try {
      const res = await fetch('/api/configuracion/feriados/seed-oficiales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Error al cargar feriados oficiales')
        return
      }
      const data = await res.json()
      alert(`Creados: ${data.creados} · Ya existentes: ${data.existentes}`)
      router.refresh()
      // Recargar la lista desde server (via refresh, pero forzamos fetch local)
      const list = await fetch('/api/configuracion/feriados')
      if (list.ok) {
        const all = await list.json()
        setFeriados(all.map((f: { id: number; fecha: string; nombre: string; recurrente: boolean }) => ({
          id: f.id,
          fecha: typeof f.fecha === 'string' ? f.fecha.slice(0, 10) : new Date(f.fecha).toISOString().slice(0, 10),
          nombre: f.nombre,
          recurrente: f.recurrente,
        })))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSeeding(false)
    }
  }

  function fmt(iso: string): string {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('es-DO', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Días feriados</h2>
              <p className="text-sm text-muted-foreground">
                El scheduler del cronograma puede saltar estos días cuando el cronograma tiene
                &ldquo;Usar feriados&rdquo; activado.
              </p>
            </div>
          </div>
          <Button
            onClick={seedOficiales}
            disabled={seeding}
            variant="secondary"
            size="sm"
          >
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Cargar feriados dominicanos oficiales
          </Button>
        </div>
      </div>

      {/* Formulario agregar */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Agregar feriado manualmente</h3>
        <form onSubmit={agregar} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="fecha" className="text-xs">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={nuevaFecha}
              onChange={e => setNuevaFecha(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nombre" className="text-xs">Nombre</Label>
            <Input
              id="nombre"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              placeholder="Ej: Feriado especial empresa"
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Agregar
          </Button>
        </form>
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      {/* Lista agrupada por año */}
      {Object.keys(porAnio).length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-10 text-center">
          <CalendarDays className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">Sin feriados cargados</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Click en &ldquo;Cargar feriados dominicanos oficiales&rdquo; para empezar
          </p>
        </div>
      ) : (
        Object.keys(porAnio).sort().reverse().map(year => (
          <div key={year} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">{year}</h4>
              <span className="text-xs text-muted-foreground">{porAnio[year].length} días</span>
            </div>
            <div className="divide-y divide-border">
              {porAnio[year].map(f => (
                <div key={f.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{f.nombre}</span>
                      {f.recurrente && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          anual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(f.fecha)}</p>
                  </div>
                  <button
                    onClick={() => eliminar(f.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
