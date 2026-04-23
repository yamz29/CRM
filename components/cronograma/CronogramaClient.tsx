'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List, Wand2, Plus, RefreshCw, Diamond, ChevronDown } from 'lucide-react'
import { CronogramaGantt } from './CronogramaGantt'
import { CronogramaV2Client } from './CronogramaV2Client'
import { ActividadesTable } from './ActividadesTable'
import { AvanceModal } from './AvanceModal'
import { GenerarModal } from './GenerarModal'

export interface Actividad {
  id: number
  cronogramaId: number
  partidaId: number | null
  capituloNombre: string | null
  nombre: string
  descripcion: string | null
  duracion: number
  fechaInicio: string | Date
  fechaFin: string | Date
  pctAvance: number
  estado: string
  tipo: string
  wbs: string | null
  dependenciaId: number | null
  tipoDependencia: string
  desfaseDias: number
  cuadrilla: string | null
  orden: number
  dependencia: { id: number; nombre: string } | null
  avances: { id: number; pctAvance: number; comentario: string | null; fecha: string | Date }[]
}

interface Cronograma {
  id: number
  nombre: string
  estado: string
  fechaInicio: string | Date
  fechaFinEstimado: string | Date | null
  notas: string | null
  proyecto: { id: number; nombre: string } | null
  presupuesto: { id: number; numero: string } | null
  actividades: Actividad[]
}

interface Props {
  cronograma: Cronograma
  presupuestosDisponibles: { id: number; numero: string; total: number }[]
  usuarios: { id: number; nombre: string }[]
}

export function CronogramaClient({ cronograma: inicial, presupuestosDisponibles, usuarios }: Props) {
  const router = useRouter()
  const [cronograma, setCronograma] = useState(inicial)
  const [vista, setVista] = useState<'ganttV2' | 'gantt' | 'tabla'>('ganttV2')
  const [avanceModal, setAvanceModal] = useState<Actividad | null>(null)
  const [generarModal, setGenerarModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState<'tarea' | 'hito' | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Sincronizar state local con la prop cuando cambia (ej. tras router.refresh).
  // Sin esto, los cambios guardados no se reflejan en la UI porque el state
  // local sigue con el snapshot inicial.
  useEffect(() => {
    setCronograma(inicial)
  }, [inicial])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(null)
    }
    if (showAddMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAddMenu])

  // Capítulos existentes para el dropdown
  const capitulosExistentes = [...new Set(cronograma.actividades.map(a => a.capituloNombre).filter(Boolean))] as string[]

  const recargar = useCallback(() => {
    router.refresh()
  }, [router])

  async function handleActualizarActividad(actividadId: number, data: Partial<Actividad>) {
    const res = await fetch(`/api/cronograma/${cronograma.id}/actividades/${actividadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) return

    // Si el cambio afecta el agendamiento, recargar todas las actividades
    // (el servidor hizo cascade a sucesoras).
    const schedulingFields: (keyof Actividad)[] = ['duracion', 'fechaInicio', 'dependenciaId', 'tipoDependencia', 'desfaseDias', 'tipo']
    const cascadeChange = schedulingFields.some(f => data[f] !== undefined)

    if (cascadeChange) {
      const all = await fetch(`/api/cronograma/${cronograma.id}/actividades`)
      if (all.ok) {
        const actividades = await all.json()
        setCronograma(prev => ({ ...prev, actividades }))
        return
      }
    }

    const updated = await res.json()
    setCronograma(prev => ({
      ...prev,
      actividades: prev.actividades.map(a => a.id === actividadId ? { ...a, ...updated } : a),
    }))
  }

  async function handleEliminarActividad(actividadId: number) {
    if (!window.confirm('¿Eliminar esta actividad?')) return
    const res = await fetch(`/api/cronograma/${cronograma.id}/actividades/${actividadId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setCronograma(prev => ({
        ...prev,
        actividades: prev.actividades.filter(a => a.id !== actividadId),
      }))
    }
  }

  async function handleRegistrarAvance(actividadId: number, pctAvance: number, comentario: string, usuarioId?: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/avance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actividadId, pctAvance, comentario, usuarioId }),
      })
      if (res.ok) {
        const { actividad } = await res.json()
        setCronograma(prev => ({
          ...prev,
          actividades: prev.actividades.map(a => a.id === actividadId ? { ...a, ...actividad } : a),
        }))
        setAvanceModal(null)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAgregarActividad(tipo: 'tarea' | 'hito' = 'tarea', capituloNombre?: string | null) {
    const fechaInicio = new Date(cronograma.fechaInicio)
    const fechaFin = tipo === 'hito' ? new Date(fechaInicio) : new Date(fechaInicio)
    if (tipo === 'tarea') fechaFin.setDate(fechaFin.getDate() + 2)

    const res = await fetch(`/api/cronograma/${cronograma.id}/actividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: tipo === 'hito' ? 'Nuevo hito' : 'Nueva actividad',
        tipo,
        fechaInicio: fechaInicio.toISOString(),
        fechaFin: fechaFin.toISOString(),
        duracion: tipo === 'hito' ? 0 : 3,
        orden: cronograma.actividades.length,
        capituloNombre: capituloNombre ?? null,
      }),
    })
    if (res.ok) {
      const nueva = await res.json()
      setCronograma(prev => ({
        ...prev,
        actividades: [...prev.actividades, { ...nueva, dependencia: null, avances: [] }],
      }))
    }
  }

  async function handleGenerar(presupuestoId: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId }),
      })
      if (res.ok) {
        setGenerarModal(false)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setVista('ganttV2')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === 'ganttV2' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
              title="Nueva vista interactiva (arrastra barras para editar)"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Gantt
            </button>
            <button
              onClick={() => setVista('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === 'gantt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
              title="Vista clásica (sólo lectura)"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Clásico
            </button>
            <button
              onClick={() => setVista('tabla')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === 'tabla' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Tabla
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={recargar}>
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </Button>
          {presupuestosDisponibles.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setGenerarModal(true)}>
              <Wand2 className="w-3.5 h-3.5" /> Generar desde presupuesto
            </Button>
          )}
          {/* Añadir actividad con selector de grupo */}
          <div className="relative" ref={capitulosExistentes.length > 0 ? addMenuRef : undefined}>
            <div className="flex items-center">
              <Button size="sm" onClick={() => {
                if (capitulosExistentes.length > 0) setShowAddMenu(showAddMenu === 'tarea' ? null : 'tarea')
                else handleAgregarActividad('tarea')
              }} className={capitulosExistentes.length > 0 ? 'rounded-r-none' : ''}>
                <Plus className="w-3.5 h-3.5" /> Añadir actividad
              </Button>
              {capitulosExistentes.length > 0 && (
                <Button size="sm" onClick={() => setShowAddMenu(showAddMenu === 'tarea' ? null : 'tarea')}
                  className="rounded-l-none border-l border-primary-foreground/20 px-1.5">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {showAddMenu === 'tarea' && (
              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-48 py-1">
                <button onClick={() => { handleAgregarActividad('tarea'); setShowAddMenu(null) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground italic">
                  Sin grupo (General)
                </button>
                <div className="border-t border-border my-1" />
                {capitulosExistentes.map(cap => (
                  <button key={cap} onClick={() => { handleAgregarActividad('tarea', cap); setShowAddMenu(null) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                    {cap}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => handleAgregarActividad('hito')}>
            <Diamond className="w-3.5 h-3.5" /> Añadir hito
          </Button>
        </div>
      </div>

      {/* Vista Gantt V2 (nueva interactiva) */}
      {vista === 'ganttV2' && (
        <CronogramaV2Client
          cronogramaId={cronograma.id}
          cronogramaNombre={cronograma.nombre}
          proyectoNombre={cronograma.proyecto?.nombre}
          usarCalendarioLaboral={(cronograma as { usarCalendarioLaboral?: boolean }).usarCalendarioLaboral ?? true}
          usarFeriados={(cronograma as { usarFeriados?: boolean }).usarFeriados ?? false}
          actividades={cronograma.actividades.map(a => ({
            id: a.id,
            nombre: a.nombre,
            duracion: a.duracion,
            fechaInicio: a.fechaInicio as unknown as string,
            fechaFin: a.fechaFin as unknown as string,
            pctAvance: a.pctAvance,
            estado: a.estado,
            tipo: a.tipo,
            dependenciaId: a.dependenciaId,
            tipoDependencia: a.tipoDependencia,
            desfaseDias: a.desfaseDias,
            esCritica: (a as { esCritica?: boolean }).esCritica,
            holguraDias: (a as { holguraDias?: number }).holguraDias,
            orden: a.orden,
          }))}
        />
      )}

      {/* Vista Gantt clásica */}
      {vista === 'gantt' && (
        <CronogramaGantt
          actividades={cronograma.actividades}
          onActualizarActividad={handleActualizarActividad}
          onAbrirAvance={setAvanceModal}
        />
      )}

      {/* Vista Tabla */}
      {vista === 'tabla' && (
        <ActividadesTable
          actividades={cronograma.actividades}
          onActualizar={handleActualizarActividad}
          onEliminar={handleEliminarActividad}
          onAbrirAvance={setAvanceModal}
        />
      )}

      {/* Modal avance */}
      {avanceModal && (
        <AvanceModal
          actividad={avanceModal}
          usuarios={usuarios}
          onGuardar={handleRegistrarAvance}
          onClose={() => setAvanceModal(null)}
          loading={loading}
        />
      )}

      {/* Modal generar */}
      {generarModal && (
        <GenerarModal
          presupuestos={presupuestosDisponibles}
          onGenerar={handleGenerar}
          onClose={() => setGenerarModal(false)}
          loading={loading}
        />
      )}
    </div>
  )
}
