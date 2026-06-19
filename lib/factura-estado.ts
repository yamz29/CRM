import { prisma } from './prisma'
import type { Prisma } from '@prisma/client'

/**
 * Recalcula y sincroniza `montoPagado` y `estado` de una factura desde la
 * suma real de lo cobrado/pagado. La fuente de verdad depende del tipo:
 *   - EGRESO  → suma de PagoFactura (pagos directos a proveedor).
 *   - INGRESO → suma de AplicacionRecibo (cobros vía recibos del cliente).
 * Un ingreso NO tiene filas en PagoFactura; sumar esa tabla pondría
 * montoPagado=0 y borraría el cobro (descuadrando "Cobrado" del proyecto).
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
    select: { id: true, total: true, estado: true, tipo: true },
  })
  if (!factura) return null
  if (factura.estado === 'anulada') return null // no tocamos anuladas

  // Ingreso: cobrado = suma de aplicaciones de recibo. Egreso: pagos directos.
  const agg = factura.tipo === 'ingreso'
    ? await db.aplicacionRecibo.aggregate({ where: { facturaId }, _sum: { monto: true } })
    : await db.pagoFactura.aggregate({ where: { facturaId }, _sum: { monto: true } })
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
