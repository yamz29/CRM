// lib/informe-economico-data.ts
// Carga de datos del Informe Económico desde Prisma (server-only).
// Compartido por el endpoint del dashboard, el export Excel y la vista PDF.

import { prisma } from './prisma'
import { MONEDA_DEFAULT, rangoPeriodoAnterior } from './gastos-informe'
import {
  construirInforme, type IngresoRow, type GastoRow, type InformeEconomicoData,
} from './informe-economico'

export interface RangoData {
  ingresos: IngresoRow[]
  gastos: GastoRow[]
  otrasMonedas: { count: number; total: number }
}

/**
 * Carga ingresos y gastos (base caja, RD$) para un rango de fechas.
 *
 *   Ingresos = pagos de facturas 'ingreso' (no anuladas), por fecha de pago.
 *   Gastos   = GastoProyecto (no Anulado, RD$)                                  [a]
 *            + pagos de facturas 'egreso' SIN gasto vinculado (no anuladas).    [b]
 *
 * La regla [b] evita doble conteo: si la factura egreso ya tiene un
 * GastoProyecto enlazado, ese gasto la representa en [a].
 */
export async function cargarRango(desde: Date, hasta: Date): Promise<RangoData> {
  const enRango = { gte: desde, lte: hasta }

  const [recibos, gastosProyecto, pagosEgreso, gastosOtraMoneda] = await Promise.all([
    prisma.recibo.findMany({
      where: { fecha: enRango, estado: { not: 'anulado' } },
      select: {
        fecha: true,
        monto: true,
        montoAplicado: true,
        aplicaciones: {
          select: { monto: true, factura: { select: { proyectoId: true, destinoTipo: true, proyecto: { select: { nombre: true } } } } },
        },
      },
    }),
    prisma.gastoProyecto.findMany({
      where: { fecha: enRango, estado: { not: 'Anulado' }, moneda: MONEDA_DEFAULT },
      select: {
        fecha: true,
        monto: true,
        destinoTipo: true,
        proyectoId: true,
        proyecto: { select: { nombre: true } },
        partida: { select: { id: true, codigo: true, descripcion: true } },
        categoria: true,
      },
    }),
    prisma.pagoFactura.findMany({
      where: {
        fecha: enRango,
        factura: { tipo: 'egreso', estado: { not: 'anulada' }, gasto: { is: null } },
      },
      select: {
        fecha: true,
        monto: true,
        factura: {
          select: { destinoTipo: true, proyectoId: true, proyecto: { select: { nombre: true } } },
        },
      },
    }),
    prisma.gastoProyecto.findMany({
      where: { fecha: enRango, estado: { not: 'Anulado' }, moneda: { not: MONEDA_DEFAULT } },
      select: { monto: true },
    }),
  ])

  const ingresos: IngresoRow[] = []
  for (const r of recibos) {
    // Parte aplicada → atribuida al proyecto de cada factura
    for (const ap of r.aplicaciones) {
      ingresos.push({
        fecha: r.fecha.toISOString(),
        monto: ap.monto,
        proyectoId: ap.factura.proyectoId,
        proyectoNombre: ap.factura.proyecto?.nombre ?? null,
        destinoTipo: ap.factura.destinoTipo,
      })
    }
    // Parte NO aplicada (anticipo) → sin proyecto ni renglón (cuenta como ingreso de caja)
    const sinAplicar = r.monto - r.montoAplicado
    if (sinAplicar > 0.01) {
      ingresos.push({ fecha: r.fecha.toISOString(), monto: sinAplicar, proyectoId: null, proyectoNombre: null, destinoTipo: null })
    }
  }

  const gastos: GastoRow[] = [
    ...gastosProyecto.map(g => ({
      fecha: g.fecha.toISOString(),
      monto: g.monto,
      destinoTipo: g.destinoTipo,
      proyectoId: g.proyectoId,
      proyectoNombre: g.proyecto?.nombre ?? null,
      partida: g.partida ?? null,
      categoria: g.categoria ?? null,
    })),
    ...pagosEgreso.map(p => ({
      fecha: p.fecha.toISOString(),
      monto: p.monto,
      destinoTipo: p.factura.destinoTipo,
      proyectoId: p.factura.proyectoId,
      proyectoNombre: p.factura.proyecto?.nombre ?? null,
      partida: null,
      categoria: null,
    })),
  ]

  return {
    ingresos,
    gastos,
    otrasMonedas: {
      count: gastosOtraMoneda.length,
      total: gastosOtraMoneda.reduce((s, g) => s + g.monto, 0),
    },
  }
}

/**
 * Construye el informe completo (período actual + anterior para el delta).
 * Devuelve también las filas crudas del período actual para el detalle Excel.
 */
export async function cargarInforme(
  desdeStr: string,
  hastaStr: string,
): Promise<{ data: InformeEconomicoData; actual: RangoData; desde: string; hasta: string }> {
  const desde = new Date(desdeStr + 'T00:00:00.000Z')
  const hasta = new Date(hastaStr + 'T23:59:59.999Z')

  const prev = rangoPeriodoAnterior(desdeStr, hastaStr)
  const prevDesde = new Date(prev.desde + 'T00:00:00.000Z')
  const prevHasta = new Date(prev.hasta + 'T23:59:59.999Z')

  const [actual, anterior] = await Promise.all([
    cargarRango(desde, hasta),
    cargarRango(prevDesde, prevHasta),
  ])

  const data = construirInforme(
    actual.ingresos,
    actual.gastos,
    anterior.ingresos,
    anterior.gastos,
    actual.otrasMonedas,
  )

  return { data, actual, desde: desdeStr, hasta: hastaStr }
}
