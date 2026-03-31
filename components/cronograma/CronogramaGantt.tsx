'use client'

import { useMemo } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'
import type { Actividad } from './CronogramaClient'

const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':     '#94a3b8',
  'En Ejecución':  '#3b82f6',
  'Completado':    '#22c55e',
  'Atrasado':      '#ef4444',
}

interface Props {
  actividades: Actividad[]
  onActualizarActividad: (id: number, data: Partial<Actividad>) => Promise<void>
  onAbrirAvance: (a: Actividad) => void
}

export function CronogramaGantt({ actividades, onActualizarActividad, onAbrirAvance }: Props) {
  const tasks: Task[] = useMemo(() => {
    if (actividades.length === 0) return []

    // Agrupar por capítulo para crear tasks de proyecto (grupo)
    const grupos = new Map<string, Actividad[]>()
    for (const a of actividades) {
      const key = a.capituloNombre ?? 'General'
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key)!.push(a)
    }

    const tasks: Task[] = []

    for (const [capitulo, acts] of grupos.entries()) {
      // Task de grupo (capítulo)
      const fechasGrupo = acts.map(a => ({
        inicio: new Date(a.fechaInicio),
        fin: new Date(a.fechaFin),
      }))
      const minInicio = new Date(Math.min(...fechasGrupo.map(f => f.inicio.getTime())))
      const maxFin = new Date(Math.max(...fechasGrupo.map(f => f.fin.getTime())))
      const pctGrupo = acts.reduce((s, a) => s + a.pctAvance, 0) / acts.length

      const grupoId = `grupo-${capitulo}`
      tasks.push({
        id: grupoId,
        name: capitulo,
        start: minInicio,
        end: maxFin,
        progress: pctGrupo,
        type: 'project',
        hideChildren: false,
        displayOrder: tasks.length,
      })

      // Tasks de actividades
      for (const a of acts) {
        const color = ESTADO_COLORS[a.estado] ?? '#94a3b8'
        tasks.push({
          id: String(a.id),
          name: a.nombre,
          start: new Date(a.fechaInicio),
          end: new Date(a.fechaFin),
          progress: a.pctAvance,
          type: 'task',
          project: grupoId,
          dependencies: a.dependenciaId ? [String(a.dependenciaId)] : undefined,
          styles: {
            backgroundColor: color,
            backgroundSelectedColor: color,
            progressColor: `${color}99`,
            progressSelectedColor: `${color}bb`,
          },
          displayOrder: tasks.length,
        })
      }
    }

    return tasks
  }, [actividades])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 bg-card border border-border rounded-xl">
        <p className="text-muted-foreground text-sm">Sin actividades. Agrega una o genera desde un presupuesto.</p>
      </div>
    )
  }

  function handleTaskChange(task: Task) {
    const actividadId = parseInt(task.id)
    if (isNaN(actividadId)) return // es un grupo
    onActualizarActividad(actividadId, {
      fechaInicio: task.start,
      fechaFin: task.end,
      duracion: Math.max(1, Math.ceil((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24))),
    })
  }

  function handleProgressChange(task: Task) {
    const actividadId = parseInt(task.id)
    if (isNaN(actividadId)) return
    onActualizarActividad(actividadId, { pctAvance: task.progress })
  }

  function handleDoubleClick(task: Task) {
    const actividadId = parseInt(task.id)
    if (isNaN(actividadId)) return
    const actividad = actividades.find(a => a.id === actividadId)
    if (actividad) onAbrirAvance(actividad)
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-4">
        <p className="text-xs text-muted-foreground">
          Arrastra las barras para mover fechas · Doble clic para registrar avance
        </p>
        <div className="flex items-center gap-3 ml-auto">
          {Object.entries(ESTADO_COLORS).map(([estado, color]) => (
            <div key={estado} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground">{estado}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Gantt
          tasks={tasks}
          viewMode={ViewMode.Day}
          onDateChange={handleTaskChange}
          onProgressChange={handleProgressChange}
          onDoubleClick={handleDoubleClick}
          listCellWidth="200px"
          columnWidth={40}
          ganttHeight={Math.min(600, tasks.length * 40 + 60)}
          locale="es"
          todayColor="rgba(59, 130, 246, 0.08)"
        />
      </div>
    </div>
  )
}
