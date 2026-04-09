import { prisma } from './prisma'

/**
 * Helpers para leer/escribir valores en la tabla `Configuracion`.
 *
 * Esta tabla es un simple key/value (clave: string, valor: string) usado para
 * configuraciones globales del sistema que no justifican un modelo propio.
 */

// ── Factor de carga social (Labor Burden) ────────────────────────────────────
//
// Multiplicador que se aplica al costo/hora bruto de cada usuario para
// reflejar la carga social real (TSS, INFOTEP, riesgos laborales, regalía,
// vacaciones, cesantía, etc.). En RD esto típicamente es 1.35 a 1.45.
//
// Ejemplo: si el sueldo cuesta RD$200/h y el factor es 1.40, el costo real
// imputado al proyecto es RD$280/h.
//
// Default = 1.0 (sin recargo) para mantener compatibilidad con datos previos.

export const CLAVE_FACTOR_CARGA = 'factor_carga_social'
export const FACTOR_CARGA_DEFAULT = 1.0

export async function getFactorCargaSocial(): Promise<number> {
  const row = await prisma.configuracion.findUnique({
    where: { clave: CLAVE_FACTOR_CARGA },
  })
  if (!row) return FACTOR_CARGA_DEFAULT
  const n = parseFloat(row.valor)
  if (isNaN(n) || n <= 0) return FACTOR_CARGA_DEFAULT
  return n
}

export async function setFactorCargaSocial(valor: number): Promise<number> {
  if (isNaN(valor) || valor <= 0) {
    throw new Error('El factor de carga social debe ser un número positivo')
  }
  await prisma.configuracion.upsert({
    where: { clave: CLAVE_FACTOR_CARGA },
    update: { valor: String(valor) },
    create: { clave: CLAVE_FACTOR_CARGA, valor: String(valor) },
  })
  return valor
}
