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

export interface SenalesProyecto {
  proyectoId: number
  costoMes: number
  costoAcum: number
  horas: number
  presupuesto: number
  avance: number      // 0-100
  diasActivos: number // días activos del proyecto dentro del mes
}

export interface DesgloseSenal {
  costoMes: number
  horas: number
  costoAcum: number
  presupuesto: number
  avance: number
}

export interface SugerenciaProyecto {
  proyectoId: number
  porcentaje: number       // 0-100, redondeado a 2 dec, suma ≤ 100
  desglose: DesgloseSenal  // aporte de cada señal en puntos de %; Σ = porcentaje
}

/**
 * Calcula el % sugerido de reparto de overhead por proyecto.
 *
 * Para cada señal i: cuotaᵢ(p) = señalᵢ(p) / Σ señalᵢ. score(p) = Σ wᵢ·cuotaᵢ(p),
 * prorrateado por diasActivos/diasDelMes, re-normalizado a 100%. Las señales sin
 * total (todas 0) se consideran "muertas" y su peso se redistribuye. Si todas las
 * señales están muertas, reparto igual prorrateado por días.
 */
export function sugerirReparto(
  proyectos: SenalesProyecto[],
  diasDelMes: number,
  pesos: PesosSugerencia = PESOS_SUGERENCIA_DEFAULT,
): SugerenciaProyecto[] {
  if (proyectos.length === 0) return []

  const totales: Record<ClaveSenal, number> = {
    costoMes: 0, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0,
  }
  for (const p of proyectos) {
    totales.costoMes += p.costoMes
    totales.horas += p.horas
    totales.costoAcum += p.costoAcum
    totales.presupuesto += p.presupuesto
    totales.avance += p.avance
  }
  const vivas: Record<ClaveSenal, boolean> = {
    costoMes: totales.costoMes > 0,
    horas: totales.horas > 0,
    costoAcum: totales.costoAcum > 0,
    presupuesto: totales.presupuesto > 0,
    avance: totales.avance > 0,
  }
  const w = normalizarPesos(pesos, vivas)
  const hayPesoVivo = CLAVES_SENAL.some(k => w[k] > 0)

  const factor = (p: SenalesProyecto) =>
    diasDelMes > 0 ? Math.min(Math.max(p.diasActivos, 0), diasDelMes) / diasDelMes : 1

  const valor = (s: ClaveSenal, p: SenalesProyecto): number => p[s]
  const crudo = proyectos.map(p => {
    const f = factor(p)
    const desglose: DesgloseSenal = { costoMes: 0, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0 }
    let score = 0
    if (hayPesoVivo) {
      for (const k of CLAVES_SENAL) {
        if (w[k] <= 0 || totales[k] <= 0) continue
        const aporte = w[k] * (valor(k, p) / totales[k]) * f
        desglose[k] = aporte
        score += aporte
      }
    } else {
      score = f
    }
    return { proyectoId: p.proyectoId, score, desglose }
  })

  const sumaScore = crudo.reduce((s, c) => s + c.score, 0)
  const escala = sumaScore > 0 ? 100 / sumaScore : 0
  const round2 = (n: number) => Math.round(n * 100) / 100

  const resultado: SugerenciaProyecto[] = crudo.map(c => {
    if (sumaScore > 0) {
      const k = escala
      const desg = c.desglose
      return {
        proyectoId: c.proyectoId,
        porcentaje: round2(c.score * k),
        desglose: {
          costoMes: round2(desg.costoMes * k),
          horas: round2(desg.horas * k),
          costoAcum: round2(desg.costoAcum * k),
          presupuesto: round2(desg.presupuesto * k),
          avance: round2(desg.avance * k),
        },
      }
    }
    const igual = round2(100 / proyectos.length)
    return {
      proyectoId: c.proyectoId,
      porcentaje: igual,
      desglose: { costoMes: igual, horas: 0, costoAcum: 0, presupuesto: 0, avance: 0 },
    }
  })

  const totalPct = resultado.reduce((s, r) => s + r.porcentaje, 0)
  const residuo = round2(100 - totalPct)
  if (residuo !== 0 && resultado.length > 0) {
    let idxMax = 0
    for (let i = 1; i < crudo.length; i++) {
      if (crudo[i].score > crudo[idxMax].score) idxMax = i
    }
    const ajustado = round2(resultado[idxMax].porcentaje + residuo)
    if (ajustado >= 0) {
      resultado[idxMax] = { ...resultado[idxMax], porcentaje: ajustado }
    }
  }

  return resultado
}
