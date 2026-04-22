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
import { addWorkingDays, type CalendarioOptions } from '@/lib/calendario-laboral'
import { calcularCriticalPath, type ActividadCpm } from '@/lib/critical-path'

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

/**
 * Suma días según el modo seleccionado.
 * - Si opts.usarCalendarioLaboral (default false para back-compat), usa
 *   addWorkingDays (salta fines de semana + feriados).
 * - Si no, suma días calendario puros (comportamiento anterior).
 */
function addDays(date: Date, days: number, opts: CalendarioOptions = {}): Date {
  if (opts.usarCalendarioLaboral) {
    return addWorkingDays(date, days, opts)
  }
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Calcula fechaInicio/fechaFin de una actividad basándose en su dependencia y duración.
 * Retorna las nuevas fechas (no persiste).
 *
 * Opcionalmente recibe opciones de calendario laboral + feriados que hacen
 * que todas las sumas/restas salten fines de semana y feriados.
 */
export function computeFechas(
  actividad: ActividadRow,
  predecesora: ActividadRow | null,
  opts: CalendarioOptions = {},
): { fechaInicio: Date; fechaFin: Date } {
  const duracion = Math.max(0, actividad.duracion || 0)

  // Sin dependencia → respeta fechaInicio actual, recalcula fechaFin
  if (!predecesora) {
    const fechaInicio = new Date(actividad.fechaInicio)
    const fechaFin = actividad.tipo === 'hito'
      ? new Date(fechaInicio)
      : addDays(fechaInicio, Math.max(0, duracion - 1), opts)
    return { fechaInicio, fechaFin }
  }

  const desfase = actividad.desfaseDias || 0

  switch (actividad.tipoDependencia) {
    case 'SS': {
      const fechaInicio = addDays(predecesora.fechaInicio, desfase, opts)
      const fechaFin = actividad.tipo === 'hito'
        ? new Date(fechaInicio)
        : addDays(fechaInicio, Math.max(0, duracion - 1), opts)
      return { fechaInicio, fechaFin }
    }
    case 'FF': {
      const fechaFin = addDays(predecesora.fechaFin, desfase, opts)
      const fechaInicio = actividad.tipo === 'hito'
        ? new Date(fechaFin)
        : addDays(fechaFin, -(Math.max(0, duracion - 1)), opts)
      return { fechaInicio, fechaFin }
    }
    case 'SF': {
      // Start-to-Finish: el fin de esta depende del inicio de la predecesora
      const fechaFin = addDays(predecesora.fechaInicio, desfase, opts)
      const fechaInicio = actividad.tipo === 'hito'
        ? new Date(fechaFin)
        : addDays(fechaFin, -(Math.max(0, duracion - 1)), opts)
      return { fechaInicio, fechaFin }
    }
    case 'FS':
    default: {
      // Inicia el día siguiente al fin de la predecesora + desfase
      const fechaInicio = addDays(predecesora.fechaFin, 1 + desfase, opts)
      const fechaFin = actividad.tipo === 'hito'
        ? new Date(fechaInicio)
        : addDays(fechaInicio, Math.max(0, duracion - 1), opts)
      return { fechaInicio, fechaFin }
    }
  }
}

/**
 * Carga las opciones de calendario (usarCalendarioLaboral + feriados) del
 * cronograma al que pertenece una actividad. Cachea las opciones por
 * cronogramaId dentro del scope de una propagación.
 */
async function cargarOptsDeCronograma(cronogramaId: number): Promise<CalendarioOptions> {
  const cron = await prisma.cronograma.findUnique({
    where: { id: cronogramaId },
    select: { usarCalendarioLaboral: true, usarFeriados: true, fechaInicio: true, fechaFinEstimado: true },
  })
  if (!cron) return {}

  const usarCalendarioLaboral = (cron as { usarCalendarioLaboral?: boolean }).usarCalendarioLaboral ?? true
  const usarFeriados = (cron as { usarFeriados?: boolean }).usarFeriados ?? false

  let feriados: Date[] = []
  if (usarFeriados) {
    // Rango amplio por si las actividades cubren varios años
    const fromYear = cron.fechaInicio.getUTCFullYear() - 1
    const toYear = (cron.fechaFinEstimado ?? cron.fechaInicio).getUTCFullYear() + 2
    const list = await prisma.diaFeriado.findMany({
      where: {
        fecha: {
          gte: new Date(Date.UTC(fromYear, 0, 1)),
          lte: new Date(Date.UTC(toYear, 11, 31)),
        },
      },
      select: { fecha: true },
    })
    feriados = list.map(f => f.fecha)
  }

  return { usarCalendarioLaboral, feriados }
}

/**
 * Re-calcula y persiste las fechas de una actividad basándose en su dependencia.
 * Si no tiene dependencia, solo ajusta fechaFin en función de la duración.
 * Retorna true si hubo cambios en las fechas.
 */
export async function rescheduleActividad(actividadId: number, optsOverride?: CalendarioOptions): Promise<boolean> {
  const act = await prisma.actividadCronograma.findUnique({
    where: { id: actividadId },
  }) as (ActividadRow & { cronogramaId: number }) | null
  if (!act) return false

  const opts = optsOverride ?? await cargarOptsDeCronograma(act.cronogramaId)

  const predecesora = act.dependenciaId
    ? ((await prisma.actividadCronograma.findUnique({
        where: { id: act.dependenciaId },
      })) as ActividadRow | null)
    : null

  const { fechaInicio, fechaFin } = computeFechas(act, predecesora, opts)

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
 * Carga las opts del cronograma una sola vez (todas las actividades del
 * mismo cronograma comparten calendario/feriados).
 * Al finalizar, recalcula el Critical Path del cronograma.
 */
export async function cascadeReschedule(rootActividadId: number): Promise<void> {
  // Obtener cronograma para cargar opts una vez
  const root = await prisma.actividadCronograma.findUnique({
    where: { id: rootActividadId },
    select: { cronogramaId: true },
  })
  if (!root) return

  const opts = await cargarOptsDeCronograma(root.cronogramaId)

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
      await rescheduleActividad(suc.id, opts)
      queue.push(suc.id)
    }
  }

  // Recalcular Critical Path tras la cascada
  await recalcularCriticalPath(root.cronogramaId, opts)
}

/**
 * Recalcula esCritica y holguraDias de todas las actividades del cronograma.
 * Usa las fechas actuales (no las recomputa — eso lo hace rescheduleActividad).
 * Persiste los resultados en DB.
 */
export async function recalcularCriticalPath(
  cronogramaId: number,
  optsOverride?: CalendarioOptions,
): Promise<void> {
  const opts = optsOverride ?? await cargarOptsDeCronograma(cronogramaId)

  const actividades = await prisma.actividadCronograma.findMany({
    where: { cronogramaId },
    select: {
      id: true, duracion: true, fechaInicio: true, fechaFin: true,
      dependenciaId: true, tipoDependencia: true, desfaseDias: true, tipo: true,
    },
  })

  if (actividades.length === 0) return

  try {
    const cpm = calcularCriticalPath(actividades as ActividadCpm[], opts)

    // Update bulk con valores CPM
    await Promise.all(cpm.map(c =>
      prisma.actividadCronograma.update({
        where: { id: c.id },
        data: { esCritica: c.esCritica, holguraDias: c.holguraDias },
      })
    ))
  } catch (e) {
    // Ciclo de dependencias u otro error — no bloquea la operación
    console.warn(`CPM no pudo calcularse para cronograma ${cronogramaId}:`, e)
  }
}
