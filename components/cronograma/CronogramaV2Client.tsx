'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, GripVertical, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { CronogramaGanttV2, type ViewMode, type GanttTask } from './CronogramaGanttV2'
import { ActividadesSpreadsheet } from './ActividadesSpreadsheet'

const LS_KEY = 'cronograma-v2-left-width'
const LS_COLLAPSED = 'cronograma-v2-left-collapsed'
const MIN_LEFT = 320
const MIN_RIGHT = 300

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
  usarCalendarioLaboral?: boolean
  usarFeriados?: boolean
}

const VIEW_MODES: ViewMode[] = ['Day', 'Week', 'Month', 'Quarter Day']

export function CronogramaV2Client({
  cronogramaId, actividades, readOnly = false,
  usarCalendarioLaboral: initCalLab = true,
  usarFeriados: initFer = false,
}: Props) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('Day')
  const [showCritical, setShowCritical] = useState(true)
  const [usarCalLab, setUsarCalLab] = useState(initCalLab)
  const [usarFer, setUsarFer] = useState(initFer)
  const [savingCal, setSavingCal] = useState(false)

  // Ancho del panel izquierdo (resizable). Persistido en localStorage.
  const [leftWidth, setLeftWidth] = useState<number>(520)
  // Panel izquierdo colapsado (oculto, Gantt full width)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  // Cargar estado persistido al montar
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY)
      if (v) {
        const n = parseInt(v)
        if (!isNaN(n) && n >= MIN_LEFT) setLeftWidth(n)
      }
      const c = localStorage.getItem(LS_COLLAPSED)
      if (c === '1') setLeftCollapsed(true)
    } catch { /* noop */ }
  }, [])

  // Persistir colapso
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSED, leftCollapsed ? '1' : '0') }
    catch { /* noop */ }
  }, [leftCollapsed])

  // Guardar ancho cuando cambia (debounced vía cleanup)
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, String(leftWidth)) }
      catch { /* noop */ }
    }, 250)
    return () => clearTimeout(t)
  }, [leftWidth])

  // Drag de la divisora
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const max = rect.width - MIN_RIGHT - 8 // 8px = ancho de la handle
      const clamped = Math.max(MIN_LEFT, Math.min(max, x))
      setLeftWidth(clamped)
    }
    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function startDrag(e: React.MouseEvent) {
    e.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  async function cambiarCalendario(nuevoCalLab: boolean, nuevoFer: boolean) {
    setSavingCal(true)
    try {
      const res = await fetch(`/api/cronograma/${cronogramaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usarCalendarioLaboral: nuevoCalLab,
          usarFeriados: nuevoFer,
        }),
      })
      if (res.ok) router.refresh()
    } finally {
      setSavingCal(false)
    }
  }

  // Convertir actividades → formato frappe-gantt
  // NOTA: custom_class solo acepta UN nombre de clase (usa classList.add
  // internamente, que no permite espacios). Prioridad: crítica > hito.
  const tasks: GanttTask[] = useMemo(() => {
    return actividades.map(a => {
      let customClass = ''
      if (showCritical && a.esCritica) customClass = 'critica'
      else if (a.tipo === 'hito') customClass = 'hito'
      return {
        id: String(a.id),
        name: a.nombre,
        start: new Date(a.fechaInicio).toISOString().slice(0, 10),
        end: new Date(a.fechaFin).toISOString().slice(0, 10),
        progress: Math.round(a.pctAvance),
        dependencies: a.dependenciaId ? String(a.dependenciaId) : '',
        custom_class: customClass,
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

        <div className="h-4 w-px bg-border mx-1" />

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={usarCalLab}
            disabled={savingCal || readOnly}
            onChange={e => { setUsarCalLab(e.target.checked); cambiarCalendario(e.target.checked, usarFer) }}
            className="rounded border-border"
          />
          Saltar fines de semana
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={usarFer}
            disabled={savingCal || readOnly || !usarCalLab}
            onChange={e => { setUsarFer(e.target.checked); cambiarCalendario(usarCalLab, e.target.checked) }}
            className="rounded border-border"
          />
          Saltar feriados
        </label>

        <div className="h-4 w-px bg-border mx-1 hidden lg:block" />

        <button
          onClick={() => setLeftCollapsed(v => !v)}
          className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors"
          title={leftCollapsed ? 'Mostrar lista de actividades' : 'Ocultar lista para ver solo el Gantt'}
        >
          {leftCollapsed ? (
            <>
              <PanelLeftOpen className="w-3.5 h-3.5" />
              Mostrar lista
            </>
          ) : (
            <>
              <PanelLeftClose className="w-3.5 h-3.5" />
              Solo Gantt
            </>
          )}
        </button>
      </div>

      {/* Desktop: layout flex con divisora arrastrable */}
      {/* Mobile: apilado vertical (lg breakpoint) */}
      {/* Altura fija con overflow-hidden para que el Gantt no empuje el
          ancho de la página. Cada panel scrollea internamente. */}
      <div
        ref={containerRef}
        className="hidden lg:flex gap-0 h-[calc(100vh-260px)] min-h-[480px] max-h-[720px] w-full overflow-hidden"
      >
        {!leftCollapsed && (
          <>
            <div
              style={{ width: leftWidth, flexShrink: 0 }}
              className="h-full overflow-hidden"
            >
              <ActividadesSpreadsheet cronogramaId={cronogramaId} actividades={actividades} />
            </div>

            {/* Divisora arrastrable */}
            <div
              onMouseDown={startDrag}
              className="relative w-2 mx-0.5 rounded bg-border hover:bg-primary cursor-col-resize flex items-center justify-center group shrink-0 transition-colors"
              title="Arrastra para redimensionar"
            >
              <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary-foreground absolute" />
            </div>
          </>
        )}

        <div className="flex-1 min-w-0 border border-border rounded-lg bg-card overflow-hidden h-full">
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

      {/* Mobile: stack vertical sin resize */}
      <div className="lg:hidden space-y-3">
        <ActividadesSpreadsheet cronogramaId={cronogramaId} actividades={actividades} />
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
        💡 Tip: arrastra una barra en el Gantt o edita las fechas en la tabla (click en la fecha). Arrastra la barra vertical entre paneles para redimensionar.
      </div>
    </div>
  )
}
