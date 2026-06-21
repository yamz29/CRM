// lib/overhead-data.ts
// Carga de datos del Overhead distribuido desde Prisma (server-only).
// Compartido por el endpoint, la pantalla de reparto y el detalle de proyecto.

import { prisma } from './prisma'
import { MONEDA_DEFAULT } from './gastos-informe'
import {
  RENGLONES_OVERHEAD, calcularPoolReal, sumarOverheadDistribuido,
  PESOS_SUGERENCIA_DEFAULT, type PesosSugerencia, type SenalesProyecto,
} from './overhead'

/** Rango UTC [inicio, fin) del mes (anio, mes 1-12). */
export function rangoMes(anio: number, mes: number): { desde: Date; hasta: Date } {
  const desde = new Date(Date.UTC(anio, mes - 1, 1, 0, 0, 0, 0))
  const hasta = new Date(Date.UTC(anio, mes, 1, 0, 0, 0, 0)) // primer día del mes siguiente
  return { desde, hasta }
}

/**
 * Pool real overhead de un mes: suma de GastoProyecto de renglón overhead
 * (oficina/taller/general), RD$, no Anulado, con fecha dentro del mes.
 */
export async function poolRealDelMes(anio: number, mes: number): Promise<number> {
  const { desde, hasta } = rangoMes(anio, mes)
  const gastos = await prisma.gastoProyecto.findMany({
    where: {
      fecha: { gte: desde, lt: hasta },
      estado: { not: 'Anulado' },
      moneda: MONEDA_DEFAULT,
      destinoTipo: { in: [...RENGLONES_OVERHEAD] },
    },
    select: { monto: true, moneda: true, estado: true, destinoTipo: true },
  })
  return calcularPoolReal(gastos)
}

/**
 * Overhead distribuido acumulado de un proyecto (suma de montoAsignado de
 * todas sus filas DistribucionOverhead). Entra en el costo real del proyecto.
 */
export async function overheadDistribuidoProyecto(proyectoId: number): Promise<number> {
  const filas = await prisma.distribucionOverhead.findMany({
    where: { proyectoId },
    select: { montoAsignado: true },
  })
  return sumarOverheadDistribuido(filas)
}

const CLAVE_PESOS_SUGERENCIA = 'overhead_pesos_sugerencia'

/**
 * Lee los pesos de sugerencia de overhead desde Configuracion (JSON) o devuelve
 * los defaults. Si el JSON es inválido o incompleto, usa defaults (log + fallback).
 */
export async function pesosSugerencia(): Promise<PesosSugerencia> {
  const row = await prisma.configuracion.findUnique({ where: { clave: CLAVE_PESOS_SUGERENCIA } })
  if (!row) return PESOS_SUGERENCIA_DEFAULT
  try {
    const j = JSON.parse(row.valor) as Partial<PesosSugerencia>
    return {
      costoMes: Number(j.costoMes ?? PESOS_SUGERENCIA_DEFAULT.costoMes),
      horas: Number(j.horas ?? PESOS_SUGERENCIA_DEFAULT.horas),
      costoAcum: Number(j.costoAcum ?? PESOS_SUGERENCIA_DEFAULT.costoAcum),
      presupuesto: Number(j.presupuesto ?? PESOS_SUGERENCIA_DEFAULT.presupuesto),
      avance: Number(j.avance ?? PESOS_SUGERENCIA_DEFAULT.avance),
    }
  } catch (e) {
    console.error('overhead_pesos_sugerencia inválido, usando defaults:', e)
    return PESOS_SUGERENCIA_DEFAULT
  }
}

/** Días del mes (anio, mes 1-12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

/**
 * Carga las 6 señales por proyecto para (anio, mes) sobre los IDs dados.
 * - costoMes / costoAcum: GastoProyecto destinoTipo=proyecto, RD$, no Anulado.
 * - horas: RegistroHoras del mes.
 * - presupuesto / avance / fechas: Proyecto.
 * diasActivos = intersección de [fechaInicio, fin] con el mes; fin = fechaCierre
 * ?? fechaEstimada ?? fin del mes. Sin fechaInicio → mes completo.
 */
export async function senalesDelMes(
  anio: number, mes: number, proyectoIds: number[],
): Promise<SenalesProyecto[]> {
  if (proyectoIds.length === 0) return []
  const { desde, hasta } = rangoMes(anio, mes)
  const dias = diasDelMes(anio, mes)

  const [gastosMes, gastosAcum, horas, proyectos] = await Promise.all([
    prisma.gastoProyecto.groupBy({
      by: ['proyectoId'],
      where: {
        proyectoId: { in: proyectoIds },
        destinoTipo: 'proyecto', moneda: MONEDA_DEFAULT, estado: { not: 'Anulado' },
        fecha: { gte: desde, lt: hasta },
      },
      _sum: { monto: true },
    }),
    prisma.gastoProyecto.groupBy({
      by: ['proyectoId'],
      where: {
        proyectoId: { in: proyectoIds },
        destinoTipo: 'proyecto', moneda: MONEDA_DEFAULT, estado: { not: 'Anulado' },
        fecha: { lt: hasta },
      },
      _sum: { monto: true },
    }),
    prisma.registroHoras.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds }, fecha: { gte: desde, lt: hasta } },
      _sum: { horas: true },
    }),
    prisma.proyecto.findMany({
      where: { id: { in: proyectoIds } },
      select: { id: true, presupuestoEstimado: true, avanceFisico: true, fechaInicio: true, fechaEstimada: true, fechaCierre: true },
    }),
  ])

  const mapaMes = new Map(gastosMes.map(g => [g.proyectoId, g._sum.monto ?? 0]))
  const mapaAcum = new Map(gastosAcum.map(g => [g.proyectoId, g._sum.monto ?? 0]))
  const mapaHoras = new Map(horas.map(h => [h.proyectoId, h._sum.horas ?? 0]))
  const mapaProyecto = new Map(proyectos.map(p => [p.id, p]))

  const msPorDia = 24 * 60 * 60 * 1000
  const diasActivosEnMes = (inicio: Date | null, fin: Date | null): number => {
    if (!inicio) return dias
    const finReal = fin ?? hasta
    const ini = inicio > desde ? inicio : desde
    const fn = finReal < hasta ? finReal : hasta
    if (fn <= ini) return 0
    const d = Math.ceil((fn.getTime() - ini.getTime()) / msPorDia)
    return Math.min(Math.max(d, 0), dias)
  }

  return proyectoIds.map(id => {
    const p = mapaProyecto.get(id)
    const fin = p?.fechaCierre ?? p?.fechaEstimada ?? null
    return {
      proyectoId: id,
      costoMes: mapaMes.get(id) ?? 0,
      costoAcum: mapaAcum.get(id) ?? 0,
      horas: mapaHoras.get(id) ?? 0,
      presupuesto: p?.presupuestoEstimado ?? 0,
      avance: p?.avanceFisico ?? 0,
      diasActivos: p ? diasActivosEnMes(p.fechaInicio ?? null, fin) : dias,
    }
  })
}
