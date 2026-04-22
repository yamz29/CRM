'use client'

import { useEffect, useRef, useState } from 'react'
// frappe-gantt se carga solo en el cliente para evitar SSR con DOM.
// Lo importamos dinámicamente dentro del useEffect.
import 'frappe-gantt/dist/frappe-gantt.css'

export type ViewMode = 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year'

export interface GanttTask {
  id: string
  name: string
  start: string        // YYYY-MM-DD
  end: string          // YYYY-MM-DD
  progress: number     // 0-100
  dependencies: string // CSV de ids de tareas predecesoras
  custom_class?: string // para clases CSS (ej: 'critica')
}

interface Props {
  tasks: GanttTask[]
  viewMode?: ViewMode
  readOnly?: boolean
  onDateChange?: (id: string, start: Date, end: Date) => void
  onProgressChange?: (id: string, progress: number) => void
  onClick?: (id: string) => void
  onViewModeChange?: (mode: ViewMode) => void
}

export function CronogramaGanttV2({
  tasks,
  viewMode = 'Day',
  readOnly = false,
  onDateChange,
  onProgressChange,
  onClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Guardamos la instancia de Gantt para poder llamarle métodos
  const ganttRef = useRef<unknown | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    async function init() {
      try {
        const GanttMod = await import('frappe-gantt')
        // El default export es la clase Gantt
        const Gantt = GanttMod.default || (GanttMod as unknown as { default: unknown }).default
        if (cancelled || !container) return

        // Limpiar contenedor antes de crear
        container.innerHTML = ''

        if (tasks.length === 0) {
          setError(null)
          return
        }

        const GanttCtor = Gantt as unknown as new (
          element: HTMLElement,
          tasks: GanttTask[],
          options: Record<string, unknown>,
        ) => {
          change_view_mode: (mode: ViewMode) => void
          refresh: (tasks: GanttTask[]) => void
        }

        ganttRef.current = new GanttCtor(container, tasks, {
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          language: 'es',
          bar_height: 26,
          bar_corner_radius: 4,
          padding: 16,
          readonly: readOnly,
          custom_popup_html: (task: GanttTask) => {
            const start = new Date(task.start).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })
            const end = new Date(task.end).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
            const isCritical = task.custom_class?.includes('critica')
            return `
              <div class="gantt-popup" style="padding: 10px 14px; background: #1e293b; color: #fff; border-radius: 6px; font-size: 12px; min-width: 200px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${task.name}</div>
                <div style="color: #94a3b8;">${start} → ${end}</div>
                <div style="margin-top: 6px; color: #cbd5e1;">Avance: <strong>${task.progress}%</strong></div>
                ${isCritical ? '<div style="margin-top: 4px; color: #fca5a5;">● Ruta crítica</div>' : ''}
              </div>
            `
          },
          on_date_change: (task: GanttTask, start: Date, end: Date) => {
            if (!readOnly && onDateChange) onDateChange(task.id, start, end)
          },
          on_progress_change: (task: GanttTask, progress: number) => {
            if (!readOnly && onProgressChange) onProgressChange(task.id, progress)
          },
          on_click: (task: GanttTask) => {
            if (onClick) onClick(task.id)
          },
        })

        setError(null)
      } catch (e) {
        console.error('Error inicializando Gantt:', e)
        setError(e instanceof Error ? e.message : 'Error al cargar el Gantt')
      }
    }

    init()

    return () => {
      cancelled = true
      ganttRef.current = null
    }
    // Reinicializar cuando cambien las tareas o viewMode
  }, [tasks, viewMode, readOnly, onDateChange, onProgressChange, onClick])

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
        Sin actividades para mostrar. Agrega tareas en el panel izquierdo.
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        Error al cargar el Gantt: {error}
      </div>
    )
  }

  return (
    <div className="cronograma-gantt-v2 overflow-x-auto">
      <style jsx global>{`
        /* Override de colores de frappe-gantt para match con tema */
        .gantt .bar {
          fill: #3b82f6;
        }
        .gantt .bar-progress {
          fill: #1d4ed8;
        }
        .gantt .bar-invalid {
          fill: transparent;
          stroke: #dc2626;
        }
        /* Ruta crítica: barra roja */
        .gantt .bar-wrapper.critica .bar {
          fill: #ef4444;
        }
        .gantt .bar-wrapper.critica .bar-progress {
          fill: #b91c1c;
        }
        /* Hitos (custom_class hito) */
        .gantt .bar-wrapper.hito .bar {
          fill: #f59e0b;
        }
        .gantt .bar-label {
          font-size: 11px;
          font-weight: 500;
        }
        .gantt .tick {
          stroke: #e5e7eb;
        }
        .gantt .today-highlight {
          fill: #fef3c7;
        }
        .dark .gantt .bar {
          fill: #60a5fa;
        }
        .dark .gantt .bar-progress {
          fill: #2563eb;
        }
        .dark .gantt .bar-wrapper.critica .bar {
          fill: #f87171;
        }
        .dark .gantt .bar-wrapper.critica .bar-progress {
          fill: #dc2626;
        }
        .dark .gantt .tick {
          stroke: #374151;
        }
        .dark .gantt .today-highlight {
          fill: rgba(251, 191, 36, 0.15);
        }
        .dark .gantt .grid-header,
        .dark .gantt .grid-row {
          fill: transparent;
        }
        .dark .gantt .lower-text,
        .dark .gantt .upper-text {
          fill: #cbd5e1;
        }
      `}</style>
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
