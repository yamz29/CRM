import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { MONEDA_DEFAULT, rangoPeriodoAnterior } from '@/lib/gastos-informe'
import { construirInforme, type IngresoRow, type GastoRow } from '@/lib/informe-economico'

/**
 * Informe Económico (Resultado) — base caja, RD$.
 *
 *   Ingresos = pagos de facturas tipo 'ingreso' (no anuladas), por fecha de pago.
 *   Gastos   = GastoProyecto (no Anulado, RD$)                                  [a]
 *            + pagos de facturas 'egreso' SIN gasto vinculado (no anuladas).    [b]
 *
 * La regla [b] evita doble conteo: si una factura egreso ya tiene un
 * GastoProyecto enlazado, ese gasto la representa en [a].
 */

interface RangoData {
  ingresos: IngresoRow[]
  gastos: GastoRow[]
  otrasMonedas: { count: number; total: number }
}

async function cargarRango(desde: Date, hasta: Date): Promise<RangoData> {
  const enRango = { gte: desde, lte: hasta }

  const [cobros, gastosProyecto, pagosEgreso, gastosOtraMoneda] = await Promise.all([
    // Ingresos: cobros de facturas de venta
    prisma.pagoFactura.findMany({
      where: { fecha: enRango, factura: { tipo: 'ingreso', estado: { not: 'anulada' } } },
      select: {
        fecha: true,
        monto: true,
        factura: { select: { proyectoId: true, proyecto: { select: { nombre: true } } } },
      },
    }),
    // Gasto [a]: gastos registrados en RD$
    prisma.gastoProyecto.findMany({
      where: { fecha: enRango, estado: { not: 'Anulado' }, moneda: MONEDA_DEFAULT },
      select: {
        fecha: true,
        monto: true,
        destinoTipo: true,
        proyectoId: true,
        proyecto: { select: { nombre: true } },
      },
    }),
    // Gasto [b]: pagos de facturas egreso sin gasto vinculado
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
    // Aviso: gastos en otra moneda excluidos del informe
    prisma.gastoProyecto.findMany({
      where: { fecha: enRango, estado: { not: 'Anulado' }, moneda: { not: MONEDA_DEFAULT } },
      select: { monto: true },
    }),
  ])

  const ingresos: IngresoRow[] = cobros.map(c => ({
    fecha: c.fecha.toISOString(),
    monto: c.monto,
    proyectoId: c.factura.proyectoId,
    proyectoNombre: c.factura.proyecto?.nombre ?? null,
  }))

  const gastos: GastoRow[] = [
    ...gastosProyecto.map(g => ({
      fecha: g.fecha.toISOString(),
      monto: g.monto,
      destinoTipo: g.destinoTipo,
      proyectoId: g.proyectoId,
      proyectoNombre: g.proyecto?.nombre ?? null,
    })),
    ...pagosEgreso.map(p => ({
      fecha: p.fecha.toISOString(),
      monto: p.monto,
      destinoTipo: p.factura.destinoTipo,
      proyectoId: p.factura.proyectoId,
      proyectoNombre: p.factura.proyecto?.nombre ?? null,
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

export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const sp = request.nextUrl.searchParams
  const desdeStr = sp.get('desde')
  const hastaStr = sp.get('hasta')
  if (!desdeStr || !hastaStr) {
    return NextResponse.json({ error: 'Faltan parámetros desde/hasta' }, { status: 400 })
  }

  const desde = new Date(desdeStr + 'T00:00:00.000Z')
  const hasta = new Date(hastaStr + 'T23:59:59.999Z')
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }

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

  return NextResponse.json(data)
}
