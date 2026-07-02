'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecursoRef {
  id: number
  codigo?: string | null
  nombre: string
  tipo: string
  unidad: string
  costoUnitario: number
}

export interface ApuRef {
  id: number
  codigo?: string | null
  nombre: string
  unidad: string
  precioVenta: number
  capitulo?: string | null
}

export interface RecursoLine {
  recursoId: number | null
  isLibre?: boolean
  descripcionLibre?: string
  unidadLibre?: string
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
}

export interface ApuLine {
  apuHijoId: number
  nombreSnapshot: string
  unidadSnapshot: string
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
}

export type TipoSeccion = 'materiales' | 'manoObra' | 'equipos' | 'subcontratos' | 'transportes'

export interface Props {
  recursos: RecursoRef[]
  apusDisponibles: ApuRef[]
  mode: 'create' | 'edit'
  initialData?: {
    id?: number
    codigo?: string
    nombre?: string
    descripcion?: string
    capitulo?: string
    unidad?: string
    indirectos?: number
    utilidad?: number
    desperdicio?: number
    rendimiento?: number | null
    volumenAnalisis?: number | null
    activo?: boolean
    observaciones?: string
    recursos?: Array<{
      tipoComponente?: string | null
      recursoId?: number | null
      apuHijoId?: number | null
      nombreSnapshot?: string | null
      unidadSnapshot?: string | null
      descripcionLibre?: string | null
      unidadLibre?: string | null
      tipoLinea?: string | null
      cantidad: number
      costoSnapshot: number
      subtotal: number
      observaciones?: string | null
      recurso?: RecursoRef | null
      apuHijo?: ApuRef | null
    }>
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SECCIONES: Array<{ key: TipoSeccion; label: string; tipos: string[]; color: string; headerColor: string }> = [
  { key: 'materiales',   label: 'Materiales',   tipos: ['materiales', 'herrajes', 'consumibles'], color: 'bg-orange-50 border-orange-200', headerColor: 'bg-orange-100 text-orange-800' },
  { key: 'manoObra',     label: 'Mano de Obra',  tipos: ['manoObra'],     color: 'bg-blue-50 border-blue-200', headerColor: 'bg-blue-100 text-blue-800' },
  { key: 'equipos',      label: 'Equipos y Herramientas', tipos: ['equipos', 'herramientas'], color: 'bg-purple-50 border-purple-200', headerColor: 'bg-purple-100 text-purple-800' },
  { key: 'subcontratos', label: 'Subcontratos',  tipos: ['subcontratos'], color: 'bg-pink-50 border-pink-200', headerColor: 'bg-pink-100 text-pink-800' },
  { key: 'transportes',  label: 'Transporte',    tipos: ['transportes'],  color: 'bg-teal-50 border-teal-200', headerColor: 'bg-teal-100 text-teal-800' },
]

export const UNIDADES = ['gl', 'ud', 'PA', 'm2', 'ml', 'm3', 'm', 'kg', 'ton', 'lt', 'saco', 'pl', 'par', 'hr', 'día', 'sem', 'mes', 'viaje', 'jg']

export const CAPITULOS = ['Preliminares', 'Demoliciones', 'Albañilería', 'Hormigón', 'Eléctricas', 'Sanitarias', 'Terminaciones', 'Pintura', 'Melamina', 'Limpieza', 'General']

// ── Helper ────────────────────────────────────────────────────────────────────

export function buildInitialSections(
  apuRecursos: NonNullable<Props['initialData']>['recursos'],
  secciones: typeof SECCIONES
): Record<TipoSeccion, RecursoLine[]> {
  const result: Record<TipoSeccion, RecursoLine[]> = {
    materiales: [], manoObra: [], equipos: [], subcontratos: [], transportes: []
  }
  if (!apuRecursos) return result

  for (const ar of apuRecursos) {
    if (ar.tipoComponente === 'apu') continue  // handled separately
    if (ar.recursoId && ar.recurso) {
      const sec = secciones.find((s) => s.tipos.includes(ar.recurso!.tipo))
      if (sec) {
        result[sec.key].push({
          recursoId: ar.recursoId,
          isLibre: false,
          cantidad: ar.cantidad,
          costoSnapshot: ar.costoSnapshot,
          subtotal: ar.subtotal,
          observaciones: ar.observaciones || '',
        })
      }
    } else if (ar.descripcionLibre) {
      const sec = secciones.find((s) => s.key === ar.tipoLinea) ?? secciones[0]
      result[sec.key].push({
        recursoId: null,
        isLibre: true,
        descripcionLibre: ar.descripcionLibre,
        unidadLibre: ar.unidadLibre || 'ud',
        cantidad: ar.cantidad,
        costoSnapshot: ar.costoSnapshot,
        subtotal: ar.subtotal,
        observaciones: ar.observaciones || '',
      })
    }
  }
  return result
}

export function buildInitialApuLines(
  apuRecursos: NonNullable<Props['initialData']>['recursos']
): ApuLine[] {
  if (!apuRecursos) return []
  return apuRecursos
    .filter((ar) => ar.tipoComponente === 'apu' && ar.apuHijoId)
    .map((ar) => ({
      apuHijoId: ar.apuHijoId!,
      nombreSnapshot: ar.nombreSnapshot || ar.apuHijo?.nombre || '',
      unidadSnapshot: ar.unidadSnapshot || ar.apuHijo?.unidad || 'gl',
      cantidad: ar.cantidad,
      costoSnapshot: ar.costoSnapshot,
      subtotal: ar.subtotal,
      observaciones: ar.observaciones || '',
    }))
}

// ── FormulaInput ──────────────────────────────────────────────────────────────

export function evalFormula(expr: string): number | null {
  const clean = expr.trim()
  if (!clean) return null
  // Only allow digits, decimal points, operators, parentheses and spaces
  if (!/^[\d\s+\-*/.()]+$/.test(clean)) return null
  try {
     
    const result = new Function('return ' + clean)() as unknown
    if (typeof result !== 'number' || !isFinite(result)) return null
    return Math.round(result * 1_000_000) / 1_000_000
  } catch {
    return null
  }
}

export function NumericInput({ value, onChange, placeholder = '0', className = '' }: {
  value: number; onChange: (v: number) => void; step?: string; placeholder?: string; className?: string
}) {
  const [raw, setRaw] = useState('')
  const [focused, setFocused] = useState(false)
  const [formulaErr, setFormulaErr] = useState(false)

  const display = focused
    ? raw
    : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    setFormulaErr(false)
    setRaw(value === 0 ? '' : String(value))
    setTimeout(() => e.target.select(), 0)
  }

  const handleBlur = () => {
    setFocused(false)
    if (!raw.trim()) { onChange(0); setFormulaErr(false); return }
    // Try formula first, then plain number
    const formulaResult = evalFormula(raw)
    if (formulaResult !== null) {
      onChange(formulaResult)
      setFormulaErr(false)
    } else {
      const plain = parseFloat(raw)
      if (!isNaN(plain)) { onChange(plain); setFormulaErr(false) }
      else setFormulaErr(true)
    }
  }

  const borderClass = formulaErr
    ? 'border-red-400 bg-red-50 focus:ring-red-400'
    : 'border-border bg-card focus:ring-blue-500'

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => { setRaw(e.target.value); setFormulaErr(false) }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={focused ? 'ej: 4*2.5' : placeholder}
      title={formulaErr ? 'Fórmula inválida. Ej: 4*2.5, 100/4, 3+1.5' : 'Soporta fórmulas: +  −  *  /  ( )'}
      className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-2 ${borderClass} ${className}`}
    />
  )
}

