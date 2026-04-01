'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List, Wand2, Plus, RefreshCw, Diamond } from 'lucide-react'
import { CronogramaGantt } from './CronogramaGantt'
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
  const [vista, setVista] = useState<'gantt' | 'tabla'>('gantt')
  const [avanceModal, setAvanceModal] = useState<Actividad | null>(null)
  const [generarModal, setGenerarModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const recargar = useCallback(() => {
    router.refresh()
  }, [router])

  async function handleActualizarActividad(actividadId: number, data: Partial<Actividad>) {
    // Validar restricción de dependencia al cambiar fechas
    if (data.fechaInicio !== undefined || data.fechaFin !== undefined) {
      const act = cronograma.actividades.find(a => a.id === actividadId)
      if (act?.dependenciaId) {
        const pred = cronograma.actividades.find(a => a.id === act.dependenciaId)
        if (pred) {
          const tipo = act.tipoDependencia
          const predFin   = new Date(pred.fechaFin)
          const predInicio = new Date(pred.fechaInicio)
          const curInicio  = data.fechaInicio ? new Date(data.fechaInicio as string) : new Date(act.fechaInicio)
          const durMs = (new Date(act.fechaFin).getTime() - new Date(act.fechaInicio).getTime())

          let minInicio: Date
          if (tipo === 'SS') minInicio = predInicio
          else if (tipo === 'FF') minInicio = new Date(predFin.getTime() - durMs)
          else minInicio = predFin // FS (default)

          if (curInicio < minInicio) {
            // Auto-snap al mínimo permitido
            const newFin = new Date(minInicio.getTime() + durMs)
            data = { ...data, fechaInicio: minInicio, fechaFin: newFin }
          }
        }
      }
    }

    const res = await fetch(`/api/cronograma/${cronograma.id}/actividades/${actividadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setCronograma(prev => ({
        ...prev,
        actividades: prev.actividades.map(a => a.id === actividadId ? { ...a, ...updated } : a),
      }))
    }
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

  async function handleAgregarActividad(tipo: 'tarea' | 'hito' = 'tarea') {
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

  async function handleGenerar(presupuestoId: number, duracionDefault: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${cronograma.id}/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId, duracionDefault }),
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
              onClick={() => setVista('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === 'gantt' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Gantt
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
          <Button size="sm" onClick={() => handleAgregarActividad('tarea')}>
            <Plus className="w-3.5 h-3.5" /> Añadir actividad
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleAgregarActividad('hito')}>
            <Diamond className="w-3.5 h-3.5" /> Añadir hito
          </Button>
        </div>
      </div>

      {/* Vista Gantt */}
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
