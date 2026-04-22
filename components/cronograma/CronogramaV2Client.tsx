'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, Flag, AlertTriangle } from 'lucide-react'
import { CronogramaGanttV2, type ViewMode, type GanttTask } from './CronogramaGanttV2'

interface Actividad {
  id: number
  nombre: string
  duracion: number
  fechaInicio: string
  fechaFin: string
  pctAvance: number
  estado: string
  tipo: string
  dependenciaId: number | null
  tipoDependencia: string
  desfaseDias: number
  esCritica?: boolean
  holguraDias?: number
  orden?: number
}

interface Props {
  cronogramaId: number
  actividades: Actividad[]
  readOnly?: boolean
}

const VIEW_MODES: ViewMode[] = ['Day', 'Week', 'Month', 'Quarter Day']

export function CronogramaV2Client({ cronogramaId, actividades, readOnly = false }: Props) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('Day')
  const [showCritical, setShowCritical] = useState(true)

  // Convertir actividades → formato frappe-gantt
  const tasks: GanttTask[] = useMemo(() => {
    return actividades.map(a => {
      const classes: string[] = []
      if (showCritical && a.esCritica) classes.push('critica')
      if (a.tipo === 'hito') classes.push('hito')
      return {
        id: String(a.id),
        name: a.nombre,
        start: new Date(a.fechaInicio).toISOString().slice(0, 10),
        end: new Date(a.fechaFin).toISOString().slice(0, 10),
        progress: Math.round(a.pctAvance),
        dependencies: a.dependenciaId ? String(a.dependenciaId) : '',
        custom_class: classes.join(' '),
      }
    })
  }, [actividades, showCritical])

  const onDateChange = useCallback(
    async (id: string, start: Date, end: Date) => {
      const actividadId = parseInt(id)
      if (isNaN(actividadId)) return

      // PATCH: actualiza fechaInicio + recalcula duración en base laboral
      // simplificado: fechaInicio + fechaFin directos, el scheduler ajusta
      try {
        const res = await fetch(`/api/cronograma/${cronogramaId}/actividades/${actividadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fechaInicio: start.toISOString(),
            fechaFin: end.toISOString(),
            _recompute: true,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          alert(d.error || 'Error al actualizar fechas')
        } else {
          router.refresh()
        }
      } catch (e) {
        console.error('onDateChange:', e)
      }
    },
    [cronogramaId, router]
  )

  const onProgressChange = useCallback(
    async (id: string, progress: number) => {
      const actividadId = parseInt(id)
      if (isNaN(actividadId)) return
      try {
        const res = await fetch(`/api/cronograma/${cronogramaId}/actividades/${actividadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pctAvance: progress }),
        })
        if (res.ok) router.refresh()
      } catch (e) {
        console.error('onProgressChange:', e)
      }
    },
    [cronogramaId, router]
  )

  const onTaskClick = useCallback(
    (id: string) => {
      // Fase 4: click abre popup nativo frappe. En Fase 5 lo reemplazaremos
      // por focus en la fila del spreadsheet lateral.
      const actividadId = parseInt(id)
      if (isNaN(actividadId)) return
      const row = document.querySelector(`[data-actividad-id="${actividadId}"]`)
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    []
  )

  const criticasCount = actividades.filter(a => a.esCritica).length

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap border border-border rounded-lg bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Zoom:</span>
          {VIEW_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border border-border hover:bg-muted/40'
              }`}
            >
              {mode === 'Quarter Day' ? '6h' :
               mode === 'Day' ? 'Día' :
               mode === 'Week' ? 'Semana' :
               mode === 'Month' ? 'Mes' : mode}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border mx-1" />

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showCritical}
            onChange={e => setShowCritical(e.target.checked)}
            className="rounded border-border"
          />
          <AlertTriangle className="w-3 h-3 text-red-500" />
          Resaltar ruta crítica ({criticasCount})
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3">
        {/* Panel izquierdo: lista de actividades (Fase 5 la hará editable) */}
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Actividades ({actividades.length})
            </h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
            {actividades.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Sin actividades. Agrega alguna desde la vista clásica.
              </div>
            ) : (
              actividades.map(a => (
                <div
                  key={a.id}
                  data-actividad-id={a.id}
                  className={`px-3 py-2 hover:bg-muted/40 transition-colors ${
                    a.esCritica ? 'border-l-2 border-l-red-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {a.tipo === 'hito' && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                    <span className="text-sm font-medium text-foreground truncate">
                      {a.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>{a.duracion}d</span>
                    <span>·</span>
                    <span>{a.pctAvance}% avance</span>
                    {a.holguraDias != null && a.holguraDias > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-green-600">holgura {a.holguraDias}d</span>
                      </>
                    )}
                    {a.esCritica && (
                      <>
                        <span>·</span>
                        <span className="text-red-600 font-semibold">crítica</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel derecho: Gantt */}
        <div className="border border-border rounded-lg bg-card overflow-hidden min-h-[400px]">
          <CronogramaGanttV2
            tasks={tasks}
            viewMode={viewMode}
            readOnly={readOnly}
            onDateChange={onDateChange}
            onProgressChange={onProgressChange}
            onClick={onTaskClick}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground px-1">
        💡 Tip: arrastra el borde derecho de una barra para cambiar duración. Arrastra al centro para mover toda la tarea. La mitad derecha de cada barra es el slider de avance.
      </div>
    </div>
  )
}
