'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineaAPU {
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
}

export interface DetalleAPU {
  materiales: LineaAPU[]
  manoObra: LineaAPU[]
  equipos: LineaAPU[]
  subcontratos: LineaAPU[]
  transporte: LineaAPU[]
}

export interface Analisis {
  materiales: number; manoObra: number; equipos: number
  subcontratos: number; transporte: number; desperdicio: number
  indirectos: number; utilidad: number; costoDirecto: number
  costoTotal: number; precioSugerido: number; margen: number
  detalle?: DetalleAPU
}

export interface Partida {
  id?: number
  _key?: string
  codigo: string; descripcion: string; unidad: string
  cantidad: number; precioUnitario: number; subtotal: number
  observaciones: string; orden: number; analisis?: Analisis
  esNota?: boolean   // si true: solo descripción, no suma al total
}

export interface Capitulo {
  id?: number
  codigo: string; nombre: string; orden: number
  tituloIdx: number | null   // null = floating (no title)
  partidas: Partida[]
}

export interface Titulo {
  id?: number
  nombre: string; orden: number; observaciones?: string
}

export interface IndirectoLinea {
  id?: number
  nombre: string; porcentaje: number; activo: boolean; orden: number
}

export interface Props {
  clientes: { id: number; nombre: string }[]
  proyectos: { id: number; nombre: string; clienteId: number }[]
  unidadesGlobales?: string[]
  mode: 'create' | 'edit'
  initialData?: {
    id?: number
    clienteId?: number; proyectoId?: number | null
    estado?: string; notas?: string
    capitulos?: Capitulo[]
    titulos?: Titulo[]
    indirectoLineas?: IndirectoLinea[]
    descuentoTipo?: string; descuentoValor?: number
    itbisActivo?: boolean; itbisPorcentaje?: number
  }
  defaultClienteId?: number
  defaultProyectoId?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CHAPTER_TEMPLATES = [
  { codigo: '01', nombre: 'Preliminares' },
  { codigo: '02', nombre: 'Demoliciones' },
  { codigo: '03', nombre: 'Albañilería' },
  { codigo: '04', nombre: 'Hormigón' },
  { codigo: '05', nombre: 'Eléctricas' },
  { codigo: '06', nombre: 'Sanitarias' },
  { codigo: '07', nombre: 'Terminaciones' },
  { codigo: '08', nombre: 'Pintura' },
  { codigo: '09', nombre: 'Melamina' },
  { codigo: '10', nombre: 'Limpieza' },
]

export const TITLE_TEMPLATES = [
  'OBRAS PRELIMINARES', 'OBRA GRIS', 'TERMINACIONES',
  'MOBILIARIO Y MELAMINA', 'INSTALACIONES', 'FACHADA',
]

export const DEFAULT_INDIRECTO_LINEAS: IndirectoLinea[] = [
  { nombre: 'Dirección técnica', porcentaje: 10, activo: true, orden: 0 },
  { nombre: 'Gastos administrativos', porcentaje: 5, activo: true, orden: 1 },
  { nombre: 'Transporte', porcentaje: 3, activo: true, orden: 2 },
  { nombre: 'Imprevistos', porcentaje: 2, activo: true, orden: 3 },
]

export const UNIDADES = ['m2', 'ml', 'm3', 'gl', 'ud', 'kg', 'hr', 'm', 'ton', 'pl', 'jg', 'día', 'sem', 'mes', 'saco', 'lt', 'lts', 'PA']
export const ESTADOS = ['Borrador', 'Enviado', 'Aprobado', 'Rechazado']
export const TAB_FIELDS = ['codigo', 'descripcion', 'unidad', 'cantidad', 'precioUnitario'] as const
export type SeccionAPU = keyof DetalleAPU

export const SECCIONES_APU: { key: SeccionAPU; label: string; color: string }[] = [
  { key: 'materiales',   label: 'Materiales',   color: 'bg-orange-50 border-orange-200' },
  { key: 'manoObra',     label: 'Mano de Obra',  color: 'bg-blue-50 border-blue-200' },
  { key: 'equipos',      label: 'Equipos',       color: 'bg-purple-50 border-purple-200' },
  { key: 'subcontratos', label: 'Subcontratos',  color: 'bg-pink-50 border-pink-200' },
  { key: 'transporte',   label: 'Transporte',    color: 'bg-teal-50 border-teal-200' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function emptyLinea(): LineaAPU { return { descripcion: '', unidad: 'gl', cantidad: 1, precioUnitario: 0 } }
export function emptyDetalle(): DetalleAPU { return { materiales: [emptyLinea()], manoObra: [], equipos: [], subcontratos: [], transporte: [] } }
export function lineaSubtotal(l: LineaAPU) { return l.cantidad * l.precioUnitario }

export function calcAnalisisFromDetalle(detalle: DetalleAPU, indirectos: number, utilidad: number): Analisis {
  const sumSec = (lines: LineaAPU[]) => lines.reduce((s, l) => s + lineaSubtotal(l), 0)
  const mat = sumSec(detalle.materiales), mo = sumSec(detalle.manoObra)
  const eq = sumSec(detalle.equipos), sub = sumSec(detalle.subcontratos), tra = sumSec(detalle.transporte)
  const costoDirecto = mat + mo + eq + sub + tra
  const costoConInd = costoDirecto * (1 + indirectos / 100)
  const precioSugerido = costoConInd * (1 + utilidad / 100)
  const margen = precioSugerido > 0 ? ((precioSugerido - costoDirecto) / precioSugerido) * 100 : 0
  return { materiales: mat, manoObra: mo, equipos: eq, subcontratos: sub, transporte: tra, desperdicio: 0, indirectos, utilidad, costoDirecto, costoTotal: costoConInd, precioSugerido, margen, detalle }
}

export function emptyPartida(orden: number): Partida {
  return { _key: nextPK(), codigo: '', descripcion: '', unidad: 'gl', cantidad: 1, precioUnitario: 0, subtotal: 0, observaciones: '', orden }
}
export function emptyNota(orden: number): Partida {
  return { _key: nextPK(), codigo: '', descripcion: '', unidad: 'gl', cantidad: 0, precioUnitario: 0, subtotal: 0, observaciones: '', orden, esNota: true }
}
export function emptyCapitulo(codigo: string, nombre: string, orden: number, tituloIdx: number | null = null): Capitulo {
  return { codigo, nombre, orden, tituloIdx, partidas: [emptyPartida(0)] }
}
export function cellKey(ci: number, pi: number, field: string) { return `cell-${ci}-${pi}-${field}` }
export function focusCell(ci: number, pi: number, field: string) {
  const el = document.querySelector<HTMLElement>(`[data-cellkey="${cellKey(ci, pi, field)}"]`)
  el?.focus()
}

// ── Arithmetic evaluator ──────────────────────────────────────────────────────
// Accepts expressions like "2.5*4", "100+50", "(3+1)/2"
export function evalExpr(raw: string): number {
  const cleaned = raw.trim()
  if (!cleaned) return 0
  if (!/^[\d\s+\-*/.()\t]+$/.test(cleaned)) return parseFloat(cleaned) || 0
  try {
     
    const result = Function(`'use strict'; return (${cleaned})`)() as unknown
    return typeof result === 'number' && isFinite(result) && result >= 0 ? result : 0
  } catch {
    return parseFloat(cleaned) || 0
  }
}
export const HAS_OP = /[+\-*/()]/
let _pk = 0
export const nextPK = () => String(++_pk)

// ── NumericCell ───────────────────────────────────────────────────────────────

export function NumericCell({
  value, onChange, cellkey, onKeyDown, className = '',
}: {
  value: number; onChange: (v: number) => void
  cellkey: string; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  step?: string; className?: string
}) {
  const [raw, setRaw] = useState<string | null>(null)
  const focused = raw !== null
  const isExpr = raw !== null && HAS_OP.test(raw)

  const commit = (rawVal: string) => {
    setRaw(null)
    onChange(evalExpr(rawVal))
  }

  const displayValue = focused
    ? raw!
    : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })

  const focusCls = isExpr
    ? 'focus:border-violet-400 focus:ring-violet-300 bg-violet-50'
    : 'focus:border-blue-400 focus:ring-blue-300 focus:bg-card'

  return (
    <input
      data-cellkey={cellkey}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={(e) => { setRaw(String(value === 0 ? '' : value)); setTimeout(() => e.target.select(), 0) }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Tab') commit((e.target as HTMLInputElement).value)
        onKeyDown(e)
      }}
      placeholder="0"
      title={isExpr ? `= ${evalExpr(raw!)}` : undefined}
      className={`w-full px-2 py-1.5 text-right text-sm border border-transparent rounded focus:outline-none focus:ring-1 hover:border-border bg-transparent transition-colors ${focusCls} ${className}`}
    />
  )
}

export function NumericCellSimple({ value, onChange, step: _step = '0.0001' }: { value: number; onChange: (v: number) => void; step?: string }) {
  const [raw, setRaw] = useState<string | null>(null)
  const focused = raw !== null
  const isExpr = raw !== null && HAS_OP.test(raw)

  const commit = (rawVal: string) => {
    setRaw(null)
    onChange(evalExpr(rawVal))
  }

  const displayValue = focused
    ? raw!
    : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })

  const focusCls = isExpr
    ? 'focus:border-violet-400 bg-violet-50'
    : 'focus:border-blue-400 focus:bg-card'

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={(e) => { setRaw(String(value === 0 ? '' : value)); setTimeout(() => e.target.select(), 0) }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
      placeholder="0"
      title={isExpr ? `= ${evalExpr(raw!)}` : undefined}
      className={`w-full px-2 py-1 text-right text-sm border border-transparent rounded focus:outline-none hover:border-border bg-transparent transition-colors ${focusCls}`}
    />
  )
}

