import { prisma } from './prisma'
import type { Prisma } from '@prisma/client'

/**
 * Recalcula y sincroniza `montoPagado` y `estado` de una factura desde la
 * suma real de PagoFactura. La fuente de verdad es la tabla de pagos —
 * cualquier drift en `factura.montoPagado` o `factura.estado` se corrige.
 *
 * NO modifica facturas con estado='anulada' (se respeta como decisión
 * explícita del usuario, sin importar si tiene pagos o no).
 *
 * Acepta opcionalmente un cliente Prisma transaccional para encadenar
 * con otras operaciones en la misma transacción.
 */
export async function recalcularEstadoFactura(
  facturaId: number,
  txClient?: Prisma.TransactionClient
): Promise<{ montoPagado: number; estado: string } | null> {
  const db = txClient ?? prisma

  const factura = await db.factura.findUnique({
    where: { id: facturaId },
    select: { id: true, total: true, estado: true },
  })
  if (!factura) return null
  if (factura.estado === 'anulada') return null // no tocamos anuladas

  const agg = await db.pagoFactura.aggregate({
    where: { facturaId },
    _sum: { monto: true },
  })
  const montoPagado = agg._sum.monto ?? 0

  // Tolerancia ±0.01 para errores de redondeo en floats.
  const estado =
    montoPagado <= 0.01 ? 'pendiente'
      : montoPagado >= factura.total - 0.01 ? 'pagada'
      : 'parcial'

  await db.factura.update({
    where: { id: facturaId },
    data: { montoPagado, estado },
  })

  return { montoPagado, estado }
}
