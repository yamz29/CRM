'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Plus, Diamond, Wand2, RefreshCw, CalendarDays, CalendarRange, Lock, FileDown } from 'lucide-react'
import { CronogramaTabla } from './CronogramaTabla'
import { CronogramaTimeline } from './CronogramaTimeline'
import { ActividadPanel } from './ActividadPanel'
import { BarraInferior } from './BarraInferior'
import { GenerarModal } from './GenerarModal'
import type { Actividad, CronogramaData } from './tipos'
import type { Escala } from '@/lib/cronograma-escala'

interface Props {
  cronograma: CronogramaData
  presupuestosDisponibles: { id: number; numero: string; total: number }[]
  readOnly?: boolean
}

export function CronogramaView({ cronograma: inicial, presupuestosDisponibles, readOnly = false }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [cronograma, setCronograma] = useState(inicial)
  const [escala, setEscala] = useState<Escala>('dia')
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(new Set())
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null)
  const [mostrarDetalles, setMostrarDetalles] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [generarModal, setGenerarModal] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminarId, setEliminarId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [usarCalLab, setUsarCalLab] = useState(inicial.usarCalendarioLaboral ?? true)
  const [usarFer, setUsarFer] = useState(inicial.usarFeriados ?? false)

  // Sincronizar state local cuando cambia la prop (tras router.refresh).
  useEffect(() => {
    setCronograma(inicial)
    setUsarCalLab(inicial.usarCalendarioLaboral ?? true)
    setUsarFer(inicial.usarFeriados ?? false)
  }, [inicial])

  const actividades = cronograma.actividades
  const capitulos = useMemo(
    () => [...new Set(actividades.map(a => a.capituloNombre).filter(Boolean))] as string[],
    [actividades],
  )
  const seleccionada = actividades.find(a => a.id === seleccionadaId) ?? null

  const criticasCount = actividades.filter(a => a.esCritica).length

  // ─── Recargar todas las actividades (tras cambios con cascade) ──
  const recargarActividades = useCallback(async () => {
    const res = await fetch(`/api/cronograma/${cronograma.id}/actividades`)
    if (res.ok) {
      const acts = await res.json()
      setCronograma(prev => ({ ...prev, actividades: acts }))
    }
  }, [cronograma.id])

  // ─── Toggle de grupo ───────────────────────────────────────────
  const toggleGrupo = useCallback((key: string) => {
    setGruposColapsados(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }, [])

  // ─── Guardar campos de la actividad ────────────────────────────
  const guardarActividad = useCallback(async (id: number, data: Partial<Actividad>) => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al guardar la actividad')
        return
      }
      // Si el cambio afecta el agendamiento, recargar todo (cascade + CPM en servidor).
      const schedulingFields: (keyof Actividad)[] = ['duracion', 'fechaInicio', 'fechaFin', 'dependenciaId', 'tipoDependencia', 'desfaseDias', 'tipo']
      const cascade = schedulingFields.some(f => data[f] !== undefined)
      if (cascade) {
        await recargarActividades()
      } else {
        const updated = await res.json()
        setCronograma(prev => ({
          ...prev,
          actividades: prev.actividades.map(a => a.id === id ? { ...a, ...updated } : a),
        }))
      }
    } finally {
      setGuardando(false)
    }
  }, [cronograma.id, toast, recargarActividades])

  // ─── Arrastre de barra → override manual de fechas ─────────────
  const arrastrar = useCallback(async (id: number, nuevoInicio: Date, nuevoFin: Date) => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/actividades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaInicio: nuevoInicio.toISOString(),
          fechaFin: nuevoFin.toISOString(),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al mover la actividad')
        return
      }
      await recargarActividades()
    } finally {
      setGuardando(false)
    }
  }, [cronograma.id, toast, recargarActividades])

  // ─── Registrar avance ──────────────────────────────────────────
  const registrarAvance = useCallback(async (id: number, pct: number, comentario: string) => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/avance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actividadId: id, pctAvance: pct, comentario }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al registrar avance')
        return
      }
      const { actividad } = await res.json()
      setCronograma(prev => ({
        ...prev,
        actividades: prev.actividades.map(a => a.id === id ? { ...a, ...actividad } : a),
      }))
      toast.exito('Avance registrado')
    } finally {
      setGuardando(false)
    }
  }, [cronograma.id, toast])

  // ─── Añadir actividad / hito ───────────────────────────────────
  const agregar = useCallback(async (tipo: 'tarea' | 'hito', capitulo: string | null) => {
    const ultimoOrden = actividades.length > 0 ? Math.max(...actividades.map(a => a.orden ?? 0)) : 0
    const res = await fetch(`/api/cronograma/${cronograma.id}/actividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: tipo === 'hito' ? 'Nuevo hito' : 'Nueva actividad',
        tipo,
        duracion: tipo === 'hito' ? 0 : 3,
        orden: ultimoOrden + 1,
        capituloNombre: capitulo,
      }),
    })
    if (res.ok) {
      const nueva = await res.json()
      setCronograma(prev => ({ ...prev, actividades: [...prev.actividades, { ...nueva, dependencia: null, avances: [] }] }))
      setSeleccionadaId(nueva.id)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'Error al crear la actividad')
    }
  }, [actividades, cronograma.id, toast])

  // ─── Reordenar ─────────────────────────────────────────────────
  const mover = useCallback(async (id: number, dir: 'up' | 'down') => {
    const ordenadas = [...actividades].sort((a, b) => (a.orden - b.orden) || (a.id - b.id))
    const idx = ordenadas.findIndex(a => a.id === id)
    if (idx === -1) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= ordenadas.length) return
    const reordenadas = [...ordenadas]
    const [m] = reordenadas.splice(idx, 1)
    reordenadas.splice(target, 0, m)
    const cambios = reordenadas
      .map((a, i) => ({ id: a.id, nuevoOrden: i + 1, prev: a.orden ?? 0 }))
      .filter(c => c.nuevoOrden !== c.prev)
    if (cambios.length === 0) return

    // Optimista
    setCronograma(prev => ({
      ...prev,
      actividades: prev.actividades.map(a => {
        const c = cambios.find(x => x.id === a.id)
        return c ? { ...a, orden: c.nuevoOrden } : a
      }),
    }))
    try {
      await Promise.all(cambios.map(c =>
        fetch(`/api/cronograma/${cronograma.id}/actividades/${c.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: c.nuevoOrden }),
        }),
      ))
    } catch {
      toast.error('Error al reordenar')
      recargarActividades()
    }
  }, [actividades, cronograma.id, toast, recargarActividades])

  // ─── Eliminar ──────────────────────────────────────────────────
  const confirmarEliminar = useCallback(async () => {
    if (eliminarId === null) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/actividades/${eliminarId}`, { method: 'DELETE' })
      if (res.ok) {
        setCronograma(prev => ({ ...prev, actividades: prev.actividades.filter(a => a.id !== eliminarId) }))
        if (seleccionadaId === eliminarId) setSeleccionadaId(null)
      }
    } finally {
      setEliminando(false)
      setEliminarId(null)
    }
  }, [eliminarId, cronograma.id, seleccionadaId])

  // ─── Generar desde presupuesto ─────────────────────────────────
  const generar = useCallback(async (presupuestoId: number) => {
    setGenerando(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/generar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId }),
      })
      if (res.ok) {
        setGenerarModal(false)
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Error al generar')
      }
    } finally {
      setGenerando(false)
    }
  }, [cronograma.id, router, toast])

  // ─── Calendario ────────────────────────────────────────────────
  const cambiarCalendario = useCallback(async (cal: boolean, fer: boolean) => {
    const res = await fetch(`/api/cronograma/${cronograma.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usarCalendarioLaboral: cal, usarFeriados: fer }),
    })
    if (res.ok) router.refresh()
  }, [cronograma.id, router])

  // ─── Estado vacío ──────────────────────────────────────────────
  if (actividades.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl bg-card/50 py-16 px-6 text-center space-y-4">
        <CalendarDays className="w-10 h-10 text-muted-foreground/50 mx-auto" />
        <div>
          <p className="text-sm font-semibold text-foreground">Este cronograma aún no tiene actividades</p>
          <p className="text-xs text-muted-foreground mt-1">Genera las tareas desde un presupuesto o añádelas a mano.</p>
        </div>
        {!readOnly && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {presupuestosDisponibles.length > 0 && (
              <Button variant="secondary" onClick={() => setGenerarModal(true)}>
                <Wand2 className="w-4 h-4" /> Generar desde presupuesto
              </Button>
            )}
            <Button onClick={() => agregar('tarea', null)}>
              <Plus className="w-4 h-4" /> Añadir actividad
            </Button>
          </div>
        )}
        {generarModal && (
          <GenerarModal presupuestos={presupuestosDisponibles} onGenerar={generar}
            onClose={() => setGenerarModal(false)} loading={generando} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border border-border rounded-lg bg-card px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de escala */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setEscala('dia')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                escala === 'dia' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Día
            </button>
            <button
              onClick={() => setEscala('semana')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                escala === 'semana' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Semana
            </button>
          </div>

          {criticasCount > 0 && (
            <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
              {criticasCount} en ruta crítica
            </span>
          )}

          {!readOnly && (
            <>
              <div className="h-4 w-px bg-border mx-1" />
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={usarCalLab}
                  onChange={e => { setUsarCalLab(e.target.checked); cambiarCalendario(e.target.checked, usarFer) }}
                  className="rounded border-border" />
                Saltar fines de semana
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={usarFer} disabled={!usarCalLab}
                  onChange={e => { setUsarFer(e.target.checked); cambiarCalendario(usarCalLab, e.target.checked) }}
                  className="rounded border-border" />
                Saltar feriados
              </label>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              <Lock className="w-3.5 h-3.5" /> Solo lectura (proyecto cerrado)
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </Button>
          <Link href={`/cronograma/${cronograma.id}/imprimir`} target="_blank">
            <Button size="sm" variant="secondary">
              <FileDown className="w-3.5 h-3.5" /> Exportar
            </Button>
          </Link>
          {!readOnly && presupuestosDisponibles.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setGenerarModal(true)}>
              <Wand2 className="w-3.5 h-3.5" /> Generar
            </Button>
          )}
          {!readOnly && (
            <>
              <Button size="sm" onClick={() => agregar('tarea', null)}>
                <Plus className="w-3.5 h-3.5" /> Tarea
              </Button>
              <Button size="sm" variant="secondary" onClick={() => agregar('hito', null)}>
                <Diamond className="w-3.5 h-3.5" /> Hito
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Split sincronizado */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="grid grid-cols-[minmax(260px,40%)_1fr]" style={{ height: 'min(70vh, 640px)' }}>
          <CronogramaTabla
            actividades={actividades}
            gruposColapsados={gruposColapsados}
            seleccionadaId={seleccionadaId}
            readOnly={readOnly}
            scrollTop={scrollTop}
            onToggleGrupo={toggleGrupo}
            onSeleccionar={setSeleccionadaId}
            onAgregar={agregar}
            onMover={mover}
            onScrollVertical={setScrollTop}
          />
          <CronogramaTimeline
            actividades={actividades}
            escala={escala}
            usarCalendarioLaboral={usarCalLab}
            gruposColapsados={gruposColapsados}
            seleccionadaId={seleccionadaId}
            readOnly={readOnly}
            scrollTop={scrollTop}
            onSeleccionar={setSeleccionadaId}
            onArrastrar={arrastrar}
            onScrollVertical={setScrollTop}
          />
        </div>
      </div>

      {!readOnly && (
        <p className="text-xs text-muted-foreground px-1">
          Arrastra una barra para mover la actividad o estira sus bordes para cambiar la duración. Haz clic en una fila o barra para editar todos sus detalles.
        </p>
      )}

      {/* Barra inferior: cuadrillas + notas (vista rápida al seleccionar) */}
      {seleccionada && (
        <BarraInferior
          actividad={seleccionada}
          readOnly={readOnly}
          guardando={guardando}
          onGuardar={guardarActividad}
          onEditarDetalles={() => setMostrarDetalles(true)}
          onClose={() => { setSeleccionadaId(null); setMostrarDetalles(false) }}
        />
      )}

      {/* Panel lateral de detalles (a demanda, desde "Editar detalles") */}
      {seleccionada && mostrarDetalles && (
        <ActividadPanel
          actividad={seleccionada}
          actividades={actividades}
          capitulos={capitulos}
          readOnly={readOnly}
          guardando={guardando}
          onGuardar={guardarActividad}
          onRegistrarAvance={registrarAvance}
          onEliminar={setEliminarId}
          onCrearOtra={(cap) => agregar('tarea', cap)}
          onClose={() => setMostrarDetalles(false)}
        />
      )}

      {/* Modal generar */}
      {generarModal && (
        <GenerarModal presupuestos={presupuestosDisponibles} onGenerar={generar}
          onClose={() => setGenerarModal(false)} loading={generando} />
      )}

      {/* Confirmar eliminación */}
      <ConfirmDialog
        abierto={eliminarId !== null}
        titulo="¿Eliminar esta actividad?"
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={eliminando}
        onConfirmar={confirmarEliminar}
        onCancelar={() => setEliminarId(null)}
      />
    </div>
  )
}
