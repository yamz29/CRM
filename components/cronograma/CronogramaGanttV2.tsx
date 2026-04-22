'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
// frappe-gantt se carga solo en el cliente para evitar SSR con DOM.
// Lo importamos dinámicamente dentro del useEffect.
// El CSS se importa local porque frappe-gantt no lo expone en su package exports.
// Si actualizas la librería: copia node_modules/frappe-gantt/dist/frappe-gantt.css
// a este directorio.
import './frappe-gantt.css'

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

  // Helpers para scrollear a fechas específicas
  const scrollToFirstTask = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const firstBar = container.querySelector('.gantt .bar') as SVGRectElement | null
    if (!firstBar) return
    const barX = parseFloat(firstBar.getAttribute('x') || '0')
    const scroller = container.closest('.cronograma-gantt-v2') as HTMLElement | null
    if (scroller) scroller.scrollTo({ left: Math.max(0, barX - 80), behavior: 'smooth' })
  }, [])

  const scrollToToday = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const todayLine = container.querySelector('.gantt .today-highlight') as SVGRectElement | null
    if (!todayLine) {
      scrollToFirstTask()
      return
    }
    const x = parseFloat(todayLine.getAttribute('x') || '0')
    const scroller = container.closest('.cronograma-gantt-v2') as HTMLElement | null
    if (scroller) scroller.scrollTo({ left: Math.max(0, x - 80), behavior: 'smooth' })
  }, [scrollToFirstTask])

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

        // Sanitizar custom_class: frappe-gantt usa classList.add() que no
        // acepta espacios. Si llega algo malformado, tomamos solo el primer
        // token para no romper el Gantt entero.
        const safeTasks = tasks.map(t => ({
          ...t,
          custom_class: t.custom_class
            ? t.custom_class.trim().split(/\s+/)[0] || ''
            : '',
        }))

        const GanttCtor = Gantt as unknown as new (
          element: HTMLElement,
          tasks: GanttTask[],
          options: Record<string, unknown>,
        ) => {
          change_view_mode: (mode: ViewMode) => void
          refresh: (tasks: GanttTask[]) => void
        }

        ganttRef.current = new GanttCtor(container, safeTasks, {
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

        // Auto-scroll horizontal al inicio de la primera tarea para que
        // el usuario no vea un timeline vacío si las fechas están lejanas.
        // Esperamos a que el DOM del Gantt esté pintado.
        requestAnimationFrame(() => {
          if (cancelled || !container) return
          // Buscar el primer elemento <rect class="bar"> dentro del SVG
          const firstBar = container.querySelector('.gantt .bar') as SVGRectElement | null
          if (firstBar) {
            // Obtener la posición X del bar dentro del SVG
            const barX = parseFloat(firstBar.getAttribute('x') || '0')
            // El contenedor con overflow es el wrapper de cronograma-gantt-v2.
            // Dar unos 80px de margen antes para que no quede pegado al borde.
            const targetScroll = Math.max(0, barX - 80)
            const scroller = container.closest('.cronograma-gantt-v2') as HTMLElement | null
            if (scroller) scroller.scrollLeft = targetScroll
          }
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
    <div className="relative cronograma-gantt-v2 overflow-x-auto overflow-y-auto h-full w-full">
      {/* Botones flotantes de navegación */}
      <div className="absolute top-2 right-3 z-10 flex gap-1">
        <button
          onClick={scrollToFirstTask}
          className="px-2 py-1 text-[10px] font-medium rounded bg-card border border-border text-foreground hover:bg-muted/60 shadow-sm transition-colors"
          title="Ir al inicio de las tareas"
          type="button"
        >
          ← Tareas
        </button>
        <button
          onClick={scrollToToday}
          className="px-2 py-1 text-[10px] font-medium rounded bg-card border border-border text-foreground hover:bg-muted/60 shadow-sm transition-colors"
          title="Ir a la fecha de hoy"
          type="button"
        >
          Hoy
        </button>
      </div>
      <style jsx global>{`
        /* Scrollbar siempre visible en el contenedor del Gantt */
        .cronograma-gantt-v2 {
          scrollbar-width: thin;
          scrollbar-gutter: stable;
        }
        .cronograma-gantt-v2::-webkit-scrollbar {
          height: 12px;
          width: 12px;
        }
        .cronograma-gantt-v2::-webkit-scrollbar-thumb {
          background: #c7c7c7;
          border-radius: 6px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .cronograma-gantt-v2::-webkit-scrollbar-thumb:hover {
          background: #888;
          background-clip: padding-box;
          border: 2px solid transparent;
        }
        .dark .cronograma-gantt-v2::-webkit-scrollbar-thumb {
          background: #4b5563;
          background-clip: padding-box;
          border: 2px solid transparent;
        }
        .dark .cronograma-gantt-v2::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
          background-clip: padding-box;
          border: 2px solid transparent;
        }

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
