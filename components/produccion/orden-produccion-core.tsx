'use client'

import type { EtapaLog, PiezaProgreso } from '@/lib/produccion'
import {
  ShoppingCart, PackageCheck, Scissors, Layers,
  Cog, ClipboardCheck, Hammer, ShieldCheck, } from 'lucide-react'

export const STAGE_ICONS: Record<string, React.ElementType> = {
  'ShoppingCart': ShoppingCart, 'PackageCheck': PackageCheck, 'Scissors': Scissors,
  'Layers': Layers, 'Cog': Cog, 'ClipboardCheck': ClipboardCheck,
  'Hammer': Hammer, 'ShieldCheck': ShieldCheck,
}

export interface Pieza {
  id: number
  nombre: string
  etiqueta: string
  largo: number
  ancho: number
  cantidad: number
  espesor: number
  material: string | null
  tapacanto: string
  llevaMecanizado: boolean
  tipoMecanizado: string | null
  moduloNombre: string
}

export interface Item {
  id: number
  nombreModulo: string
  tipoModulo: string | null
  dimensiones: string | null
  cantidad: number
  observaciones: string | null
  completado: boolean
}

export interface Material {
  id: number
  nombre: string
  tipo: string | null
  unidad: string
  cantidadRequerida: number
  cantidadComprada: number
  cantidadRecibida: number
  costoUnitario: number
  costoTotal: number
  proveedor: string | null
  estado: string
  notas: string | null
}

export interface QCItem {
  item: string
  checked: boolean
}

export interface Orden {
  id: number
  codigo: string
  nombre: string
  estado: string
  etapaActual: string
  prioridad: string
  clienteNombre: string | null
  notas: string | null
  checklistQCProceso: string | null
  checklistQCFinal: string | null
  notasQCProceso: string | null
  notasQCFinal: string | null
  etapasLog: string | null
  progresoPiezas: string | null
  proyecto: { id: number; nombre: string } | null
  items: Item[]
  materiales: Material[]
  fechaInicio: string | null
  fechaEstimada: string | null
  createdAt: string
}

export interface Props {
  orden: Orden
  usuarios: { id: number; nombre: string }[]
  piezas: Pieza[]
}

// ── Helper: parse stage timestamps ──
export function parseEtapasLog(json: string | null): EtapaLog[] {
  try { return json ? JSON.parse(json) : [] } catch { return [] }
}

export function parsePiezaProgreso(json: string | null): Record<string, PiezaProgreso> {
  try { return json ? JSON.parse(json) : {} } catch { return {} }
}

export function formatDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const hours = (e - s) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)} hrs`
  return `${(hours / 24).toFixed(1)} días`
}

