/**
 * Critical Path Method (CPM) para cronogramas.
 *
 * Algoritmo:
 *   1. Orden topológico de las actividades (por dependencias).
 *   2. Forward pass: calcula inicio/fin tempranos (early start/finish).
 *   3. Backward pass: calcula inicio/fin tardíos (late start/finish).
 *   4. Holgura (float) = late start - early start = late finish - early finish.
 *   5. Actividad crítica = holgura == 0.
 *
 * La ruta crítica es el conjunto de actividades con holgura = 0. Un atraso
 * en cualquiera de ellas atrasa la fecha de entrega del proyecto.
 *
 * Nota: trabajamos con días LABORALES (o calendario según opts). Las fechas
 * ya vienen computadas por `computeFechas` del scheduler; este módulo
 * solo calcula la holgura comparando fechas tempranas vs tardías.
 */

import { addWorkingDays, diffWorkingDays, type CalendarioOptions } from './calendario-laboral'

export interface ActividadCpm {
  id: number
  duracion: number
  fechaInicio: Date
  fechaFin: Date
  dependenciaId: number | null
  tipoDependencia: string   // FS | SS | FF | SF
  desfaseDias: number
  tipo: string              // tarea | hito
}

export interface ResultadoCpm {
  id: number
  earlyStart: Date
  earlyFinish: Date
  lateStart: Date
  lateFinish: Date
  holguraDias: number
  esCritica: boolean
}

// ═══════════════════════════════════════════════════════════════════════
// Orden topológico
// ═══════════════════════════════════════════════════════════════════════

/**
 * Retorna las actividades ordenadas de forma que ninguna aparezca antes
 * que su predecesora. Si hay un ciclo lanza error.
 */
function ordenTopologico(actividades: ActividadCpm[]): ActividadCpm[] {
  const byId = new Map(actividades.map(a => [a.id, a]))
  const visitado = new Set<number>()
  const resuelto = new Set<number>()
  const orden: ActividadCpm[] = []

  function visitar(id: number, path: Set<number>) {
    if (resuelto.has(id)) return
    if (visitado.has(id) && path.has(id)) {
      throw new Error(`Ciclo de dependencias detectado en actividad ${id}`)
    }
    visitado.add(id)
    path.add(id)
    const a = byId.get(id)
    if (a && a.dependenciaId != null && byId.has(a.dependenciaId)) {
      visitar(a.dependenciaId, path)
    }
    path.delete(id)
    if (!resuelto.has(id) && a) {
      resuelto.add(id)
      orden.push(a)
    }
  }

  for (const a of actividades) {
    if (!resuelto.has(a.id)) visitar(a.id, new Set())
  }
  return orden
}

// ═══════════════════════════════════════════════════════════════════════
// Forward pass: inicio/fin tempranos
// ═══════════════════════════════════════════════════════════════════════

/**
 * Para CPM usamos las fechas que ya vienen computadas (earlyStart = fechaInicio
 * actual, earlyFinish = fechaFin actual). Esto asume que fechas ya fueron
 * calculadas por el scheduler con computeFechas. Si no lo están, el CPM
 * igual funciona pero la holgura no será útil.
 */
function forwardPass(orden: ActividadCpm[]): Map<number, { es: Date; ef: Date }> {
  const result = new Map<number, { es: Date; ef: Date }>()
  for (const a of orden) {
    result.set(a.id, {
      es: new Date(a.fechaInicio),
      ef: new Date(a.fechaFin),
    })
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════════
// Backward pass: inicio/fin tardíos
// ═══════════════════════════════════════════════════════════════════════

/**
 * Recorre en orden inverso. Para cada actividad:
 *   - Si no tiene sucesoras: lateFinish = earlyFinish (es hoja).
 *   - Si tiene sucesoras: lateFinish = min(lateStart de sucesoras con ajustes
 *     por tipo de dependencia).
 *   - lateStart = lateFinish - duracion + 1 (o igual si es hito).
 */
function backwardPass(
  orden: ActividadCpm[],
  early: Map<number, { es: Date; ef: Date }>,
  opts: CalendarioOptions,
): Map<number, { ls: Date; lf: Date }> {
  const byId = new Map(orden.map(a => [a.id, a]))

  // Construir mapa de sucesoras: para cada actividad, lista de sucesoras
  const sucesoras = new Map<number, ActividadCpm[]>()
  for (const a of orden) {
    if (a.dependenciaId != null && byId.has(a.dependenciaId)) {
      const arr = sucesoras.get(a.dependenciaId) ?? []
      arr.push(a)
      sucesoras.set(a.dependenciaId, arr)
    }
  }

  // Fin del proyecto = max de earlyFinish de todas las actividades.
  // Las actividades sin sucesoras deben tomar este valor como lateFinish
  // (no su propio earlyFinish), para que las ramas cortas tengan holgura.
  let projectEnd = new Date(0)
  for (const e of early.values()) {
    if (e.ef > projectEnd) projectEnd = new Date(e.ef)
  }

  const result = new Map<number, { ls: Date; lf: Date }>()

  // Recorrer en orden inverso del orden topológico
  for (let i = orden.length - 1; i >= 0; i--) {
    const a = orden[i]
    const ef = early.get(a.id)!.ef
    const sucs = sucesoras.get(a.id) ?? []
    let lateFinish: Date = sucs.length === 0 ? new Date(projectEnd) : new Date(ef)

    if (sucs.length > 0) {
      // Con sucesoras partimos de un deadline "infinito" (projectEnd) y
      // lo ajustamos hacia abajo según cada sucesora.
      lateFinish = new Date(projectEnd)
      // Para cada sucesora calcular el deadline que esta actividad
      // impone según el tipo de dependencia
      for (const suc of sucs) {
        const sucLs = result.get(suc.id)!.ls
        const sucLf = result.get(suc.id)!.lf
        const desfase = suc.desfaseDias ?? 0

        let deadlineFin: Date
        switch (suc.tipoDependencia) {
          case 'SS':
            // La sucesora empieza cuando esta empieza → esta debe terminar
            // "cuando pueda" pero al menos antes de que la sucesora necesite arrancar.
            // sucesora.es = this.es + desfase → this.es <= sucLs - desfase
            // No pone deadline sobre this.lateFinish directamente; sin embargo,
            // para mantener coherencia usamos lateFinish = earlyFinish si solo hay SS.
            // Conservador: no se atrasa lateFinish por sucesora SS.
            deadlineFin = new Date(ef)
            break
          case 'FF':
            // Fin sucesora = fin esta + desfase → this.lf = sucLf - desfase
            deadlineFin = addWorkingDays(sucLf, -desfase, opts)
            break
          case 'SF':
            // Fin sucesora = inicio esta + desfase → impone sobre this.ls, no lf
            deadlineFin = new Date(ef)
            break
          case 'FS':
          default:
            // sucesora.es = this.ef + 1 + desfase → this.lf = sucLs - 1 - desfase
            deadlineFin = addWorkingDays(sucLs, -1 - desfase, opts)
            break
        }

        if (deadlineFin < lateFinish) {
          lateFinish = deadlineFin
        }
      }
    }

    const duracion = Math.max(0, a.duracion || 0)
    const lateStart = a.tipo === 'hito'
      ? new Date(lateFinish)
      : addWorkingDays(lateFinish, -Math.max(0, duracion - 1), opts)

    result.set(a.id, { ls: lateStart, lf: lateFinish })
  }

  return result
}

// ═══════════════════════════════════════════════════════════════════════
// API pública
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calcula la holgura y marca actividades críticas para un cronograma.
 *
 * Retorna un array con id, earlyStart/Finish, lateStart/Finish, holguraDias
 * y esCritica (holgura == 0). No persiste — el caller debe actualizar la DB.
 *
 * Si alguna actividad tiene un ciclo con su predecesora, retorna array vacío
 * y propaga error.
 */
export function calcularCriticalPath(
  actividades: ActividadCpm[],
  opts: CalendarioOptions = {},
): ResultadoCpm[] {
  if (actividades.length === 0) return []

  const orden = ordenTopologico(actividades)
  const early = forwardPass(orden)
  const late = backwardPass(orden, early, opts)

  return actividades.map(a => {
    const e = early.get(a.id)!
    const l = late.get(a.id)!
    const holgura = diffWorkingDays(e.es, l.ls, opts) - (e.es <= l.ls ? 0 : 0)
    // diffWorkingDays es inclusive en ambos extremos; si ls == es, diff = 1, queremos 0
    const holguraReal = e.es.getTime() === l.ls.getTime()
      ? 0
      : diffWorkingDays(e.es, l.ls, opts) - 1

    return {
      id: a.id,
      earlyStart: e.es,
      earlyFinish: e.ef,
      lateStart: l.ls,
      lateFinish: l.lf,
      holguraDias: Math.max(0, holguraReal),
      esCritica: Math.max(0, holguraReal) === 0,
    }
  })
}
