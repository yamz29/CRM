/**
 * Generación de códigos consecutivos por tipo de proyecto.
 *
 * Formato: <PREFIJO>-<NNNN> (padding a 4 dígitos).
 *   R-0001, R-0002, ...  → Remodelación
 *   C-0001, C-0002, ...  → Construcción
 *   D-0001, ...          → Diseño
 *   M-0001, ...          → Melamina / Ebanistería
 *   S-0001, ...          → Servicios
 *
 * Cada tipo lleva su propio contador.
 */

import { prisma } from '@/lib/prisma'

export const PREFIJO_POR_TIPO: Record<string, string> = {
  'Remodelación':  'R',
  'Construcción':  'C',
  'Diseño':        'D',
  'Melamina':      'M',
  'Servicios':     'S',
}

/**
 * Retorna el prefijo correspondiente al tipo de proyecto.
 * Si el tipo no está mapeado, usa la primera letra en mayúscula.
 */
export function prefijoDeTipo(tipoProyecto: string): string {
  return PREFIJO_POR_TIPO[tipoProyecto] ?? (tipoProyecto.charAt(0).toUpperCase() || 'X')
}

/**
 * Dado un código "R-0042", retorna el número (42). Retorna 0 si no se puede parsear.
 */
export function numeroDeCodigo(codigo: string | null | undefined): number {
  if (!codigo) return 0
  const m = codigo.match(/-(\d+)$/)
  return m ? parseInt(m[1]) : 0
}

/**
 * Genera el siguiente código disponible para el tipo indicado.
 * Busca el máximo actual en la base y le suma 1.
 *
 * Nota: No usa transacción — en caso de alta concurrencia podrían colisionar.
 * El @unique del schema previene duplicados silenciosos: si hay race, la
 * segunda inserción falla y el caller puede reintentar.
 */
export async function generarCodigoProyecto(tipoProyecto: string): Promise<string> {
  const prefijo = prefijoDeTipo(tipoProyecto)
  const existentes = await prisma.proyecto.findMany({
    where: { codigo: { startsWith: `${prefijo}-` } },
    select: { codigo: true },
  })
  const maxNum = existentes.reduce((max, p) => Math.max(max, numeroDeCodigo(p.codigo)), 0)
  const siguiente = maxNum + 1
  return `${prefijo}-${String(siguiente).padStart(4, '0')}`
}
