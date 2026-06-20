// lib/overhead-data.ts
// Carga de datos del Overhead distribuido desde Prisma (server-only).
// Compartido por el endpoint, la pantalla de reparto y el detalle de proyecto.

import { prisma } from './prisma'
import { MONEDA_DEFAULT } from './gastos-informe'
import {
  RENGLONES_OVERHEAD, calcularPoolReal, sumarOverheadDistribuido,
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
