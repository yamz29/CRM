'use client'


export interface Proyecto {
  id: number
  codigo: string | null
  nombre: string
  cliente: string
  tipoProyecto: string
  estado: string
  fechaInicio: string | null
  fechaEstimada: string | null
  avance: number
  archivada: boolean
}

export interface Hito {
  id: number
  nombre: string
  fecha: string
  descripcion: string | null
  color: string | null
  icono: string | null
  proyectoId: number | null
}

export interface TareaG {
  id: number
  nombre: string
  fechaInicio: string
  fechaFin: string
  descripcion: string | null
  color: string | null
  avance: number
  proyectoId: number | null
}

export type Escala = 'dia' | 'semana' | 'mes'

export interface Props {
  proyectos: Proyecto[]
  hitos: Hito[]
  tareas: TareaG[]
  estadosExistentes: string[]
  estadosFiltro: string[]
  verArchivados: boolean
}

// Colores por estado (consistente con EstadoProyectoBadge)
export const ESTADO_COLORS: Record<string, string> = {
  'Prospecto':     '#94a3b8',
  'En Cotización': '#8b5cf6',
  'Adjudicado':    '#eab308',
  'En Ejecución':  '#3b82f6',
  'Terminado':     '#22c55e',
  'Finalizado':    '#22c55e',
  'Pausado':       '#f97316',
  'Cancelado':     '#ef4444',
}

export const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Constantes de layout
export const ROW_HEIGHT = 36
export const HEADER_HEIGHT = 40
export const LABEL_WIDTH = 260
export const MIN_BAR_WIDTH = 8

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / (1000 * 60 * 60 * 24))
}

// Lunes de la semana de d
export function startOfWeek(d: Date): Date {
  const c = startOfDay(d)
  const day = c.getDay() // 0=dom, 1=lun, ...
  const diff = day === 0 ? 6 : day - 1 // mover al lunes anterior
  return addDays(c, -diff)
}

// Devuelve número ISO de semana (aprox, suficiente visual)
export function isoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

export function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
}

