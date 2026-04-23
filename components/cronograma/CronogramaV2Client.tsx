'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, FileDown } from 'lucide-react'
import { CronogramaGanttV2, type ViewMode, type GanttTask } from './CronogramaGanttV2'
import { ActividadesSpreadsheet } from './ActividadesSpreadsheet'

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
  proyectoNombre?: string
  cronogramaNombre?: string
}

const VIEW_MODES: ViewMode[] = ['Day', 'Week', 'Month', 'Quarter Day']

export function CronogramaV2Client({
  cronogramaId, actividades, readOnly = false,
  usarCalendarioLaboral: initCalLab = true,
  usarFeriados: initFer = false,
  proyectoNombre,
  cronogramaNombre,
}: Props) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>('Day')
  const [showCritical, setShowCritical] = useState(true)
  const [usarCalLab, setUsarCalLab] = useState(initCalLab)
  const [usarFer, setUsarFer] = useState(initFer)
  const [savingCal, setSavingCal] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const ganttWrapRef = useRef<HTMLDivElement>(null)

  async function exportarPDF() {
    const wrap = ganttWrapRef.current
    if (!wrap) return
    setExportingPdf(true)
    try {
      // Buscar el scroller interno de frappe-gantt y expandirlo para capturar todo.
      const scroller = wrap.querySelector('.gantt-container') as HTMLElement | null
      const svg = wrap.querySelector('.gantt') as SVGElement | null
      const origOverflow = scroller?.style.overflow
      const origMaxH = wrap.style.maxHeight
      const origH = wrap.style.height
      if (scroller) scroller.style.overflow = 'visible'
      wrap.style.maxHeight = 'none'
      wrap.style.height = 'auto'

      // Calcular dimensiones reales del SVG del Gantt para no cortarlo.
      const svgRect = svg?.getBoundingClientRect()
      const fullWidth = Math.max(wrap.scrollWidth, svgRect?.width ?? 0)
      const fullHeight = Math.max(wrap.scrollHeight, svgRect?.height ?? 0)

      const [{ default: html2canvas }, jsPdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const { jsPDF } = jsPdfMod

      const canvas = await html2canvas(wrap, {
        backgroundColor: '#ffffff',
        scale: 2,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        useCORS: true,
      })

      // Restaurar estilos
      if (scroller) scroller.style.overflow = origOverflow ?? ''
      wrap.style.maxHeight = origMaxH
      wrap.style.height = origH

      // PDF landscape A4. Ajustar ancho al papel, paginar verticalmente si es largo.
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 24
      const headerH = 36

      // Encabezado
      const titulo = cronogramaNombre || 'Cronograma'
      const sub = proyectoNombre ? `Proyecto: ${proyectoNombre}` : ''
      const fecha = new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })

      // Escalar imagen a ancho de página
      const imgW = pageW - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width
      const availH = pageH - margin * 2 - headerH
      const imgData = canvas.toDataURL('image/png')

      const drawHeader = (pageNum: number, totalPages: number) => {
        pdf.setFontSize(14); pdf.setFont('helvetica', 'bold')
        pdf.text(titulo, margin, margin + 4)
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
        if (sub) pdf.text(sub, margin, margin + 20)
        const right = `${fecha}   —   Página ${pageNum}/${totalPages}`
        pdf.text(right, pageW - margin, margin + 12, { align: 'right' })
      }

      if (imgH <= availH) {
        drawHeader(1, 1)
        pdf.addImage(imgData, 'PNG', margin, margin + headerH, imgW, imgH)
      } else {
        // Paginar verticalmente recortando porciones del canvas.
        const pxPerPage = (availH * canvas.width) / imgW
        const totalPages = Math.ceil(canvas.height / pxPerPage)
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage()
          const sy = i * pxPerPage
          const sh = Math.min(pxPerPage, canvas.height - sy)
          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = canvas.width
          pageCanvas.height = sh
          const ctx = pageCanvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, sh)
            ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)
          }
          const pageImg = pageCanvas.toDataURL('image/png')
          const pageImgH = (sh * imgW) / canvas.width
          drawHeader(i + 1, totalPages)
          pdf.addImage(pageImg, 'PNG', margin, margin + headerH, imgW, pageImgH)
        }
      }

      const fname = `cronograma-${(proyectoNombre || cronogramaNombre || 'gantt').replace(/[^a-zA-Z0-9-_]+/g, '_')}.pdf`
      pdf.save(fname)
    } catch (e) {
      console.error('export PDF:', e)
      alert('Error al exportar PDF: ' + (e instanceof Error ? e.message : 'desconocido'))
    } finally {
      setExportingPdf(false)
    }
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
  // NOTA: custom_class solo acepta UN nombre de clase. Prioridad: crítica > hito.
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

        <div className="h-4 w-px bg-border mx-1" />

        <button
          onClick={exportarPDF}
          disabled={exportingPdf || actividades.length === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border bg-background hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exportar el Gantt como PDF para imprimir o compartir con el cliente"
        >
          <FileDown className="w-3 h-3" />
          {exportingPdf ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>

      {/* Layout simple: grid de dos columnas (actividades | gantt).
          Apilado vertical en móvil. Ancho fijo sin divisora arrastrable. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(500px,1fr)_1fr] gap-3">
        <ActividadesSpreadsheet cronogramaId={cronogramaId} actividades={actividades} />

        <div ref={ganttWrapRef} className="border border-border rounded-lg bg-card overflow-hidden min-h-[400px]">
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
        💡 Tip: arrastra una barra en el Gantt o edita las fechas en la tabla (click en la fecha). Los cambios manuales sobrescriben el cálculo automático de dependencias.
      </div>
    </div>
  )
}
