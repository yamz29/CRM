// Cálculo puro del "resumen de avance" de un cronograma.
// Todas las fechas de calendario se normalizan a UTC midnight (mismo criterio
// que el resto del cronograma: ver components/cronograma/tipos.ts -> aFecha).

const MS_DIA = 86_400_000

export interface ActividadResumen {
  fechaInicio: string | Date
  fechaFin: string | Date
  pctAvance: number
  tipo: string
}

export interface ResumenAvance {
  finProyectado: Date | null
  avanceReal: number       // 0-100, redondeado
  avanceEsperado: number   // 0-100, redondeado
  deltaAvance: number      // real - esperado, redondeado
  diasDesviacion: number | null // finProyectado - meta (días calendario); null si falta meta o no hay actividades
  diasTranscurridos: number     // desde fechaInicio hasta hoy (>= 0)
  diasRestantes: number         // hoy hasta finProyectado (puede ser negativo = vencido); 0 si no hay actividades
}

/** Convierte una fecha a su timestamp UTC midnight. */
function aUTC(v: string | Date): number {
  const d = new Date(v)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** % esperado hoy de una actividad según su ventana de fechas (0-100). */
export function avanceEsperadoActividad(act: ActividadResumen, hoy: Date): number {
  const inicio = aUTC(act.fechaInicio)
  const fin = aUTC(act.fechaFin)
  const t = aUTC(hoy)
  if (inicio === fin) return t >= inicio ? 100 : 0 // hito o duración 0
  if (t <= inicio) return 0
  if (t >= fin) return 100
  return ((t - inicio) / (fin - inicio)) * 100
}

/** Calcula el resumen de avance del cronograma. `hoy` se inyecta para testear. */
export function calcularResumen(
  actividades: ActividadResumen[],
  fechaInicio: string | Date,
  meta: string | Date | null,
  hoy: Date = new Date(),
): ResumenAvance {
  const t = aUTC(hoy)
  const inicioT = aUTC(fechaInicio)
  const hayActs = actividades.length > 0

  const finProyectadoT = hayActs
    ? Math.max(...actividades.map(a => aUTC(a.fechaFin)))
    : null

  const avanceReal = hayActs
    ? Math.round(actividades.reduce((s, a) => s + a.pctAvance, 0) / actividades.length)
    : 0

  const avanceEsperado = hayActs
    ? Math.round(actividades.reduce((s, a) => s + avanceEsperadoActividad(a, hoy), 0) / actividades.length)
    : 0

  const metaT = meta ? aUTC(meta) : null
  const diasDesviacion = (finProyectadoT !== null && metaT !== null)
    ? Math.round((finProyectadoT - metaT) / MS_DIA)
    : null

  const diasTranscurridos = Math.max(0, Math.round((t - inicioT) / MS_DIA))
  const diasRestantes = finProyectadoT !== null
    ? Math.round((finProyectadoT - t) / MS_DIA)
    : 0

  return {
    finProyectado: finProyectadoT !== null ? new Date(finProyectadoT) : null,
    avanceReal,
    avanceEsperado,
    deltaAvance: avanceReal - avanceEsperado,
    diasDesviacion,
    diasTranscurridos,
    diasRestantes,
  }
}
