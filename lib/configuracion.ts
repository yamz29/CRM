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

// ── Tasas de nómina (RD) ─────────────────────────────────────────────────────
//
// AFP y SFS son deducciones obligatorias de ley sobre el salario bruto del
// empleado. Simplificación deliberada: no se aplican topes salariales ni ISR
// (ver content/help/nomina.md). El factor de hora extra es el recargo legal
// sobre la tarifa hora normal (Ley 16-92, art. 203: 1.35 para las primeras
// 2 horas extra del día).

export const CLAVE_TASA_AFP = 'tasa_afp'
export const CLAVE_TASA_SFS = 'tasa_sfs'
export const CLAVE_FACTOR_HORA_EXTRA = 'factor_hora_extra'

export const TASA_AFP_DEFAULT = 2.87
export const TASA_SFS_DEFAULT = 3.04
export const FACTOR_HORA_EXTRA_DEFAULT = 1.35

async function getTasa(clave: string, valorDefault: number): Promise<number> {
  const row = await prisma.configuracion.findUnique({ where: { clave } })
  if (!row) return valorDefault
  const n = parseFloat(row.valor)
  if (isNaN(n) || n < 0) return valorDefault
  return n
}

async function setTasa(clave: string, valor: number): Promise<number> {
  if (isNaN(valor) || valor < 0) {
    throw new Error('La tasa debe ser un número positivo')
  }
  await prisma.configuracion.upsert({
    where: { clave },
    update: { valor: String(valor) },
    create: { clave, valor: String(valor) },
  })
  return valor
}

export const getTasaAfp = () => getTasa(CLAVE_TASA_AFP, TASA_AFP_DEFAULT)
export const setTasaAfp = (valor: number) => setTasa(CLAVE_TASA_AFP, valor)

export const getTasaSfs = () => getTasa(CLAVE_TASA_SFS, TASA_SFS_DEFAULT)
export const setTasaSfs = (valor: number) => setTasa(CLAVE_TASA_SFS, valor)

export const getFactorHoraExtra = () => getTasa(CLAVE_FACTOR_HORA_EXTRA, FACTOR_HORA_EXTRA_DEFAULT)
export const setFactorHoraExtra = (valor: number) => setTasa(CLAVE_FACTOR_HORA_EXTRA, valor)
