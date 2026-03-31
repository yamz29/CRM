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
  return d.toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getEstadoProyectoColor(estado: string): string {
  const colors: Record<string, string> = {
    'Prospecto': 'bg-slate-100 text-slate-700 border-slate-200',
    'En Cotización': 'bg-blue-100 text-blue-700 border-blue-200',
    'Adjudicado': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'En Ejecución': 'bg-green-100 text-green-700 border-green-200',
    'Terminado': 'bg-slate-200 text-slate-600 border-slate-300',
    'Cancelado': 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[estado] || 'bg-gray-100 text-gray-700 border-gray-200'
}

export function getEstadoPresupuestoColor(estado: string): string {
  const colors: Record<string, string> = {
    'Borrador': 'bg-slate-100 text-slate-700 border-slate-200',
    'Enviado': 'bg-blue-100 text-blue-700 border-blue-200',
    'Aprobado': 'bg-green-100 text-green-700 border-green-200',
    'Rechazado': 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[estado] || 'bg-gray-100 text-gray-700 border-gray-200'
}

export function getEstadoColor(estado: string): string {
  return getEstadoProyectoColor(estado) || getEstadoPresupuestoColor(estado)
}

export type TipoCliente = 'Particular' | 'Empresa' | 'Arquitecto' | 'Inmobiliaria'
export type FuenteCliente = 'Referido' | 'Web' | 'Instagram' | 'Facebook' | 'Directo' | 'Otro'
export type TipoProyecto = 'Remodelación' | 'Construcción' | 'Diseño' | 'Melamina'
export type EstadoProyecto = 'Prospecto' | 'En Cotización' | 'Adjudicado' | 'En Ejecución' | 'Terminado' | 'Cancelado'
export type EstadoPresupuesto = 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado'
export type TipoModulo = 'Base' | 'Aéreo' | 'Columna' | 'Panel'
