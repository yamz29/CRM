/**
 * Generación de números consecutivos para facturas.
 *
 * Dos secuencias separadas:
 *   - Factura proforma:  PRO-YYYY-0001, PRO-YYYY-0002, ...
 *   - Factura fiscal:    FAC-YYYY-0001, FAC-YYYY-0002, ...
 *
 * El año se reinicia cada ejercicio. Cuando una proforma se convierte
 * en fiscal, conserva su número PRO original (se identifica por el NCF).
 */

import { prisma } from '@/lib/prisma'

function currentYear(): number {
  return new Date().getFullYear()
}

/**
 * Retorna el siguiente número PRO-YYYY-NNNN disponible.
 * Busca el máximo actual en la tabla factura con prefijo del año.
 */
export async function generarNumeroProforma(): Promise<string> {
  const year = currentYear()
  const prefix = `PRO-${year}-`
  const existentes = await prisma.factura.findMany({
    where: { numero: { startsWith: prefix } },
    select: { numero: true },
  })
  let max = 0
  for (const f of existentes) {
    const m = f.numero.match(/-(\d+)$/)
    if (m) {
      const n = parseInt(m[1])
      if (!isNaN(n) && n > max) max = n
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/**
 * Retorna el siguiente número FAC-YYYY-NNNN disponible (para facturas
 * fiscales emitidas desde cero, no desde una proforma).
 */
export async function generarNumeroFactura(): Promise<string> {
  const year = currentYear()
  const prefix = `FAC-${year}-`
  const existentes = await prisma.factura.findMany({
    where: { numero: { startsWith: prefix } },
    select: { numero: true },
  })
  let max = 0
  for (const f of existentes) {
    const m = f.numero.match(/-(\d+)$/)
    if (m) {
      const n = parseInt(m[1])
      if (!isNaN(n) && n > max) max = n
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
