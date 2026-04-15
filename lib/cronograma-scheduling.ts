/**
 * Agendamiento tipo Microsoft Project con PDM (Precedence Diagramming Method).
 *
 * Reglas:
 *   - fechaFin = fechaInicio + duracion - 1 día (inclusivo)
 *   - Si hay dependenciaId, la fecha se calcula desde la predecesora según
 *     los 4 tipos de relación PDM, más desfaseDias (lag positivo = espera,
 *     negativo = adelanto):
 *       FS (Finish-to-Start): fechaInicio = pred.fechaFin + 1 + desfase
 *       SS (Start-to-Start):  fechaInicio = pred.fechaInicio + desfase
 *       FF (Finish-to-Finish): fechaFin   = pred.fechaFin + desfase
 *                              fechaInicio = fechaFin - duracion + 1
 *       SF (Start-to-Finish): fechaFin    = pred.fechaInicio + desfase
 *                              fechaInicio = fechaFin - duracion + 1
 *   - Al cambiar una actividad, se propagan en cascada todas las sucesoras.
 */

import { prisma } from '@/lib/prisma'

type ActividadRow = {
  id: number
  duracion: number
  fechaInicio: Date
  fechaFin: Date
  dependenciaId: number | null
  tipoDependencia: string
  desfaseDias: number
  tipo: string
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Calcula fechaInicio/fechaFin de una actividad basándose en su dependencia y duración.
 * Retorna las nuevas fechas (no persiste).
 */
export function computeFechas(
  actividad: ActividadRow,
  predecesora: ActividadRow | null,
): { fechaInicio: Date; fechaFin: Date } {
  const duracion = Math.max(0, actividad.duracion || 0)

  // Sin dependencia → respeta fechaInicio actual, recalcula fechaFin
  if (!predecesora) {
    const fechaInicio = new Date(actividad.fechaInicio)
    const fechaFin = actividad.tipo === 'hito'
      ? new Date(fechaInicio)
      : addDays(fechaInicio, Math.max(0, duracion - 1))
    return { fechaInicio, fechaFin }
  }

  const desfase = actividad.desfaseDias || 0

  switch (actividad.tipoDependencia) {
    case 'SS': {
      const fechaInicio = addDays(predecesora.fechaInicio, desfase)
      const fechaFin = actividad.tipo === 'hito'
        ? new Date(fechaInicio)
        : addDays(fechaInicio, Math.max(0, duracion - 1))
      return { fechaInicio, fechaFin }
    }
    case 'FF': {
      const fechaFin = addDays(predecesora.fechaFin, desfase)
      const fechaInicio = actividad.tipo === 'hito'
        ? new Date(fechaFin)
        : addDays(fechaFin, -(Math.max(0, duracion - 1)))
      return { fechaInicio, fechaFin }
    }
    case 'SF': {
      // Start-to-Finish: el fin de esta depende del inicio de la predecesora
      const fechaFin = addDays(predecesora.fechaInicio, desfase)
      const fechaInicio = actividad.tipo === 'hito'
        ? new Date(fechaFin)
        : addDays(fechaFin, -(Math.max(0, duracion - 1)))
      return { fechaInicio, fechaFin }
    }
    case 'FS':
    default: {
      // Inicia el día siguiente al fin de la predecesora + desfase
      const fechaInicio = addDays(predecesora.fechaFin, 1 + desfase)
      const fechaFin = actividad.tipo === 'hito'
        ? new Date(fechaInicio)
        : addDays(fechaInicio, Math.max(0, duracion - 1))
      return { fechaInicio, fechaFin }
    }
  }
}

/**
 * Re-calcula y persiste las fechas de una actividad basándose en su dependencia.
 * Si no tiene dependencia, solo ajusta fechaFin en función de la duración.
 * Retorna true si hubo cambios en las fechas.
 */
export async function rescheduleActividad(actividadId: number): Promise<boolean> {
  const act = await prisma.actividadCronograma.findUnique({
    where: { id: actividadId },
  }) as ActividadRow | null
  if (!act) return false

  const predecesora = act.dependenciaId
    ? ((await prisma.actividadCronograma.findUnique({
        where: { id: act.dependenciaId },
      })) as ActividadRow | null)
    : null

  const { fechaInicio, fechaFin } = computeFechas(act, predecesora)

  const changed =
    fechaInicio.getTime() !== new Date(act.fechaInicio).getTime() ||
    fechaFin.getTime() !== new Date(act.fechaFin).getTime()

  if (changed) {
    await prisma.actividadCronograma.update({
      where: { id: actividadId },
      data: { fechaInicio, fechaFin },
    })
  }
  return changed
}

/**
 * Propaga cambios de fechas a todas las actividades sucesoras (en cascada, recursivo).
 * Evita ciclos con un Set de IDs visitados.
 */
export async function cascadeReschedule(rootActividadId: number): Promise<void> {
  const visited = new Set<number>()
  const queue: number[] = [rootActividadId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    // Buscar sucesoras
    const sucesoras = await prisma.actividadCronograma.findMany({
      where: { dependenciaId: currentId },
      select: { id: true },
    })

    for (const suc of sucesoras) {
      if (visited.has(suc.id)) continue
      await rescheduleActividad(suc.id)
      queue.push(suc.id)
    }
  }
}
