// lib/overhead.ts
// Lógica pura del "Overhead distribuido": reparto manual, mes a mes, de los
// gastos fijos (oficina/taller/general) entre los proyectos activos.
//
// El pool mensual es la suma REAL de los gastos overhead de ese mes. El
// usuario reparte ese pool por porcentaje entre proyectos; la porción de
// cada proyecto (pool × % / 100) se acumula y entra en su costo real.
//
// Funciones puras, testeables, separadas del acceso a Prisma (igual que
// lib/informe-economico.ts). Reusa el criterio de overhead ya usado en el
// Informe Económico (destinoTipo IN oficina|taller|general, no Anulado).

import { MONEDA_DEFAULT } from './gastos-informe'

// Renglones que se consideran overhead de empresa (no atribuibles a un
// proyecto). Coincide con los destinos no-proyecto del Informe Económico,
// excluyendo 'sin_asignar' (gastos sin clasificar, que no se reparten).
export const RENGLONES_OVERHEAD = ['oficina', 'taller', 'general'] as const

export function esGastoOverhead(destinoTipo: string | null | undefined): boolean {
  return (RENGLONES_OVERHEAD as readonly string[]).includes(destinoTipo ?? '')
}

// ── Pool real del mes ──────────────────────────────────────────────────

// Fila mínima de gasto necesaria para calcular el pool. Es un subconjunto
// de lo que devuelve Prisma para GastoProyecto.
export interface GastoOverheadRow {
  monto: number
  moneda: string
  estado: string
  destinoTipo: string
}

/**
 * Suma el pool overhead de un conjunto de gastos ya filtrados por mes.
 * Solo cuenta gastos en RD$, no Anulados, de renglón overhead.
 */
export function calcularPoolReal(gastos: GastoOverheadRow[]): number {
  return gastos.reduce((acc, g) => {
    if (g.estado === 'Anulado') return acc
    if (g.moneda !== MONEDA_DEFAULT) return acc
    if (!esGastoOverhead(g.destinoTipo)) return acc
    return acc + g.monto
  }, 0)
}

// ── Reparto ────────────────────────────────────────────────────────────

/** Porción que le toca a un proyecto: pool × % / 100. */
export function montoPorcentaje(poolReal: number, porcentaje: number): number {
  return poolReal * porcentaje / 100
}

export interface AsignacionInput {
  proyectoId: number
  porcentaje: number
}

/** Suma de porcentajes asignados (para validar que no exceda 100). */
export function totalPorcentaje(asignaciones: AsignacionInput[]): number {
  return asignaciones.reduce((s, a) => s + (a.porcentaje || 0), 0)
}

/**
 * Valida un reparto: la suma de porcentajes no puede superar 100 (con una
 * tolerancia de ±0.01 para errores de redondeo). Devuelve null si es válido
 * o un mensaje de error.
 */
export function validarReparto(asignaciones: AsignacionInput[]): string | null {
  for (const a of asignaciones) {
    if (a.porcentaje < 0) return 'Los porcentajes no pueden ser negativos'
    if (a.porcentaje > 100.01) return 'Un porcentaje no puede superar el 100%'
  }
  if (totalPorcentaje(asignaciones) > 100.01) {
    return 'La suma de porcentajes no puede superar el 100%'
  }
  return null
}

// ── Overhead distribuido acumulado de un proyecto ──────────────────────

export interface DistribucionRow {
  montoAsignado: number
}

/**
 * Suma el overhead distribuido total de un proyecto a partir de sus filas
 * de DistribucionOverhead. Es la porción de overhead que entra en su costo
 * real (acumulada sobre todos los meses).
 */
export function sumarOverheadDistribuido(filas: DistribucionRow[]): number {
  return filas.reduce((s, d) => s + (d.montoAsignado || 0), 0)
}

// ── Sugerencia de reparto (índice de esfuerzo compuesto) ───────────────

export interface PesosSugerencia {
  costoMes: number
  horas: number
  costoAcum: number
  presupuesto: number
  avance: number
}

/** Pesos por defecto (suman 1). Configurables vía Configuracion. */
export const PESOS_SUGERENCIA_DEFAULT: PesosSugerencia = {
  costoMes: 0.35,
  horas: 0.25,
  costoAcum: 0.20,
  presupuesto: 0.15,
  avance: 0.05,
}

export type ClaveSenal = keyof PesosSugerencia
const CLAVES_SENAL: ClaveSenal[] = ['costoMes', 'horas', 'costoAcum', 'presupuesto', 'avance']

/**
 * Normaliza pesos a Σ=1, anulando las señales "muertas" (sin datos en el mes)
 * y redistribuyendo su peso proporcionalmente entre las vivas. Si todas están
 * muertas, devuelve todo en 0 (el caller hará fallback a reparto igual).
 */
export function normalizarPesos(
  pesos: PesosSugerencia,
  senalesVivas: Record<ClaveSenal, boolean>,
): PesosSugerencia {
  const sumaVivas = CLAVES_SENAL.reduce(
    (s, k) => s + (senalesVivas[k] ? pesos[k] : 0), 0,
  )
  const out = { costoMes: 0, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0 } as PesosSugerencia
  if (sumaVivas <= 0) return out
  for (const k of CLAVES_SENAL) {
    out[k] = senalesVivas[k] ? pesos[k] / sumaVivas : 0
  }
  return out
}
