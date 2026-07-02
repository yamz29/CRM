import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'RD$ 0.00'
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `RD$ ${formatted}`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  // timeZone: 'UTC' es CRÍTICO: en el CRM las fechas "de calendario"
  // (proyectos, cronograma, facturas) se guardan como UTC midnight
  // (ej. "2026-04-24T00:00:00Z"). Sin forzar UTC, el navegador las convierte
  // a hora local (Santo Domingo UTC-4) y retrocede un día — el usuario
  // pone "24 abr" y ve "23 abr".
  return d.toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export type TipoCliente = 'Particular' | 'Empresa' | 'Arquitecto' | 'Inmobiliaria'
export type FuenteCliente = 'Referido' | 'Web' | 'Instagram' | 'Facebook' | 'Directo' | 'Otro'
export type TipoProyecto = 'Remodelación' | 'Construcción' | 'Diseño' | 'Melamina'
export type EstadoProyecto = 'Prospecto' | 'En Cotización' | 'Adjudicado' | 'En Ejecución' | 'Terminado' | 'Cancelado'
export type EstadoPresupuesto = 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado'
export type TipoModulo = 'Base' | 'Aéreo' | 'Columna' | 'Panel'
