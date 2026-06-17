import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { prisma } from '@/lib/prisma'

interface FilaImportablePago {
  facturaId: number
  fecha: string                 // ISO
  monto: number
  metodoPago: string
  cuentaBancariaId: number | null
  referencia: string | null
  observaciones: string | null
}

/**
 * POST /api/cobros/pagos/importar
 * Body: { filas: FilaImportablePago[] }  (solo filas válidas; el cliente omite las de error)
 *
 * Registra todos los pagos en UNA transacción:
 *   - crea cada PagoFactura
 *   - agrupa por factura para recalcular montoPagado/estado una sola vez
 *   - crea el MovimientoBancario conciliado por cada pago con cuenta
 * Misma lógica que el registro de pago individual. Si algo falla, revierte todo.
 */
export const POST = withPermiso('contabilidad', 'editar', async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  const filas: FilaImportablePago[] = body?.filas ?? []

  if (!Array.isArray(filas) || filas.length === 0) {
    return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
  }
  if (filas.length > 500) {
    return NextResponse.json({ error: 'Demasiadas filas (máx 500 por importación)' }, { status: 400 })
  }
  for (const f of filas) {
    if (!Number.isInteger(f.facturaId)) {
      return NextResponse.json({ error: 'Una fila no tiene factura válida' }, { status: 400 })
    }
    if (typeof f.monto !== 'number' || !(f.monto > 0) || isNaN(f.monto)) {
      return NextResponse.json({ error: `Monto inválido para la factura ${f.facturaId}` }, { status: 400 })
    }
    if (!f.fecha) {
      return NextResponse.json({ error: `Fecha vacía para la factura ${f.facturaId}` }, { status: 400 })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const ids = [...new Set(filas.map(f => f.facturaId))]
      const facturas = await tx.factura.findMany({ where: { id: { in: ids }, tipo: 'ingreso' } })
      const facturaMap = new Map(facturas.map(f => [f.id, f]))

      let pagosCreados = 0
      const afectadas = new Set<number>()

      for (const f of filas) {
        const factura = facturaMap.get(f.facturaId)
        if (!factura) throw new Error(`Factura ${f.facturaId} no encontrada (tipo ingreso)`)
        if (factura.estado === 'anulada') throw new Error(`Factura ${factura.numero} está anulada`)

        const fechaPago = new Date(f.fecha)

        await tx.pagoFactura.create({
          data: {
            facturaId: f.facturaId,
            fecha: fechaPago,
            monto: f.monto,
            metodoPago: f.metodoPago || 'Transferencia',
            referencia: f.referencia || null,
            cuentaBancariaId: f.cuentaBancariaId ?? null,
            observaciones: f.observaciones || null,
          },
        })
        pagosCreados++
        afectadas.add(f.facturaId)

        if (f.cuentaBancariaId) {
          await tx.movimientoBancario.create({
            data: {
              cuentaBancariaId: f.cuentaBancariaId,
              fecha: fechaPago,
              tipo: 'credito',                     // cobro = entra dinero
              monto: f.monto,
              descripcion: `Cobro factura #${factura.numero}`,
              referencia: f.referencia || null,
              conciliado: true,
              facturaId: f.facturaId,
            },
          })
        }
      }

      // Recalcular montoPagado/estado una vez por factura afectada
      for (const facturaId of afectadas) {
        const factura = facturaMap.get(facturaId)!
        const agg = await tx.pagoFactura.aggregate({ where: { facturaId }, _sum: { monto: true } })
        const nuevoMontoPagado = agg._sum.monto || 0
        if (nuevoMontoPagado > factura.total + 0.01) {
          throw new Error(`Factura ${factura.numero}: los pagos exceden el total de la factura`)
        }
        const nuevoEstado = nuevoMontoPagado >= factura.total - 0.01
          ? 'pagada' : nuevoMontoPagado > 0 ? 'parcial' : 'pendiente'
        await tx.factura.update({
          where: { id: facturaId },
          data: { montoPagado: nuevoMontoPagado, estado: nuevoEstado },
        })
      }

      return { pagosCreados, facturasActualizadas: afectadas.size }
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[importar pagos]', error)
    const msg = error instanceof Error ? error.message : 'Error al importar pagos'
    return NextResponse.json(
      { error: `${msg}. Ningún pago fue registrado (transacción revertida).` },
      { status: 500 }
    )
  }
})
