// Tipos compartidos por la vista unificada de cronograma.

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
  notas?: string | null
  materiales?: string | null
  esCritica?: boolean
  holguraDias?: number
  orden: number
  dependencia?: { id: number; nombre: string } | null
  avances?: { id: number; pctAvance: number; comentario: string | null; fecha: string | Date }[]
}

export interface CronogramaData {
  id: number
  nombre: string
  estado: string
  fechaInicio: string | Date
  fechaFinEstimado: string | Date | null
  notas: string | null
  usarCalendarioLaboral?: boolean
  usarFeriados?: boolean
  proyecto: { id: number; nombre: string } | null
  presupuesto: { id: number; numero: string } | null
  actividades: Actividad[]
}

export const ALTURA_FILA = 40 // px — altura de cada fila/pista (tabla y timeline alineados)
export const ALTURA_GRUPO = 36 // px — altura del encabezado de grupo
export const ALTURA_HEADER_ESCALA = 44 // px — encabezado de columnas

/** Color de la barra según estado. Devuelve clases de fondo Tailwind. */
export function colorEstado(a: Actividad): { barra: string; relleno: string; texto: string } {
  if (a.esCritica && a.estado !== 'Completado') {
    return { barra: 'bg-red-200 dark:bg-red-900/40', relleno: 'bg-red-500', texto: 'text-red-700 dark:text-red-300' }
  }
  switch (a.estado) {
    case 'Completado':
      return { barra: 'bg-teal-200 dark:bg-teal-900/40', relleno: 'bg-teal-500', texto: 'text-teal-700 dark:text-teal-300' }
    case 'En Ejecución':
      return { barra: 'bg-blue-200 dark:bg-blue-900/40', relleno: 'bg-blue-500', texto: 'text-blue-700 dark:text-blue-300' }
    case 'Atrasado':
      return { barra: 'bg-red-200 dark:bg-red-900/40', relleno: 'bg-red-500', texto: 'text-red-700 dark:text-red-300' }
    default: // Pendiente
      return { barra: 'bg-slate-200 dark:bg-slate-700/60', relleno: 'bg-slate-400 dark:bg-slate-500', texto: 'text-slate-600 dark:text-slate-300' }
  }
}

/** Convierte fechaInicio/fechaFin (string|Date) a Date UTC midnight de forma segura. */
export function aFecha(v: string | Date): Date {
  const d = typeof v === 'string' ? new Date(v) : v
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** Agrupa actividades por capituloNombre conservando el orden de aparición. */
export function agruparPorCapitulo(actividades: Actividad[]): { capitulo: string | null; items: Actividad[] }[] {
  const orden = [...actividades].sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden
    return a.id - b.id
  })
  const grupos: { capitulo: string | null; items: Actividad[] }[] = []
  const indice = new Map<string, number>()
  for (const a of orden) {
    const key = a.capituloNombre ?? '__sin_grupo__'
    if (!indice.has(key)) {
      indice.set(key, grupos.length)
      grupos.push({ capitulo: a.capituloNombre, items: [] })
    }
    grupos[indice.get(key)!].items.push(a)
  }
  return grupos
}
