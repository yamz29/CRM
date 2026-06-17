// lib/recibos.ts
// Lógica de recibos de cobro. Las funciones puras (estado, numeración,
// validación) no tocan Prisma; recalcularFactura recibe el client/tx.

import type { Prisma, PrismaClient } from '@prisma/client'

const EPS = 0.01

// ── Estado del recibo según monto aplicado ──────────────────────────────
export function estadoRecibo(monto: number, montoAplicado: number): string {
  if (montoAplicado <= EPS) return 'sin_aplicar'
  if (montoAplicado >= monto - EPS) return 'aplicado'
  return 'parcial'
}

// ── Estado de la factura según lo pagado ────────────────────────────────
export function estadoFactura(total: number, montoPagado: number): string {
  if (montoPagado >= total - EPS) return 'pagada'
  if (montoPagado > EPS) return 'parcial'
  return 'pendiente'
}

// ── Siguiente número REC-YYYY-NNNN dado el máximo del año ────────────────
// ultimoNumero: el numero REC más alto del año (o null si no hay).
export function siguienteNumeroRecibo(ultimoNumero: string | null, anio: number): string {
  let n = 0
  if (ultimoNumero) {
    const m = ultimoNumero.match(/REC-\d{4}-(\d+)/)
    if (m) n = parseInt(m[1], 10)
  }
  return `REC-${anio}-${String(n + 1).padStart(4, '0')}`
}

// ── Validación de una lista de aplicaciones de un recibo ─────────────────
export interface AplicacionInput { facturaId: number; monto: number }
export interface FacturaSaldo { id: number; total: number; montoPagado: number; estado: string }

/**
 * Valida que las aplicaciones no excedan el monto del recibo ni el saldo de
 * cada factura. Devuelve lista de errores (vacía = ok).
 */
export function validarAplicaciones(
  montoRecibo: number,
  aplicaciones: AplicacionInput[],
  facturas: Map<number, FacturaSaldo>,
): string[] {
  const errores: string[] = []
  let suma = 0
  const porFactura = new Map<number, number>()
  for (const a of aplicaciones) {
    if (!(a.monto > 0)) { errores.push(`Aplicación a factura ${a.facturaId}: monto debe ser > 0`); continue }
    const f = facturas.get(a.facturaId)
    if (!f) { errores.push(`Factura ${a.facturaId} no encontrada`); continue }
    if (f.estado === 'anulada') { errores.push(`Factura ${a.facturaId} está anulada`); continue }
    suma += a.monto
    porFactura.set(a.facturaId, (porFactura.get(a.facturaId) ?? 0) + a.monto)
  }
  if (suma > montoRecibo + EPS) {
    errores.push(`Las aplicaciones (${suma.toFixed(2)}) exceden el monto del recibo (${montoRecibo.toFixed(2)})`)
  }
  for (const [facturaId, aplicado] of porFactura) {
    const f = facturas.get(facturaId)!
    const saldo = f.total - f.montoPagado
    if (aplicado > saldo + EPS) {
      errores.push(`Factura ${facturaId}: aplicado ${aplicado.toFixed(2)} excede su saldo (${saldo.toFixed(2)})`)
    }
  }
  return errores
}

// ── Recálculo de una factura desde sus aplicaciones (server, dentro de tx) ─
type Tx = PrismaClient | Prisma.TransactionClient

export async function recalcularFactura(tx: Tx, facturaId: number): Promise<void> {
  const factura = await tx.factura.findUnique({ where: { id: facturaId }, select: { total: true } })
  if (!factura) return
  const agg = await tx.aplicacionRecibo.aggregate({ where: { facturaId }, _sum: { monto: true } })
  const montoPagado = agg._sum.monto ?? 0
  await tx.factura.update({
    where: { id: facturaId },
    data: { montoPagado, estado: estadoFactura(factura.total, montoPagado) },
  })
}

// ── Recálculo del estado/aplicado de un recibo (server, dentro de tx) ─────
export async function recalcularRecibo(tx: Tx, reciboId: number): Promise<void> {
  const recibo = await tx.recibo.findUnique({ where: { id: reciboId }, select: { monto: true, estado: true } })
  if (!recibo || recibo.estado === 'anulado') return
  const agg = await tx.aplicacionRecibo.aggregate({ where: { reciboId }, _sum: { monto: true } })
  const montoAplicado = agg._sum.monto ?? 0
  await tx.recibo.update({
    where: { id: reciboId },
    data: { montoAplicado, estado: estadoRecibo(recibo.monto, montoAplicado) },
  })
}
