/**
 * Helpers para nombrar y ubicar facturas en SharePoint.
 *
 * Estructura: <SP_ROOT>/Facturas/YYYY/MM/<nombre-archivo>
 *   ej: /Proyectos/Facturas/2026/04/Ferreteria-FAC-0012345.pdf
 *
 * El archivo se nombra combinando proveedor (sanitizado) + número de
 * factura. Si falta el proveedor, solo número. Si falta el número,
 * se usa un sufijo con la ID de la factura.
 */

import { sanitizeFolderName } from '@/lib/sharepoint'

export function carpetaFactura(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `Facturas/${year}/${month}`
}

/**
 * Construye un nombre de archivo seguro para SharePoint.
 * Extrae extensión del original y la conserva.
 *
 * Ejemplos:
 *   nombre("Ferretería Americana SRL", "0012345", "image.jpg")
 *     → "Ferreteria-Americana-FAC-0012345.jpg"
 *
 *   nombre(null, "FAC-001", "file.pdf", 42)
 *     → "FAC-001-id42.pdf"   (fallback sin proveedor)
 */
export function nombreArchivoFactura(
  proveedor: string | null | undefined,
  numero: string | null | undefined,
  originalName: string,
  facturaId?: number,
): string {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase()

  // Sanitizar proveedor: quitar acentos, caracteres especiales, espacios a guiones,
  // recortar a 40 chars
  const provClean = proveedor
    ? sanitizeFolderName(proveedor)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')       // quitar acentos
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40)
    : ''

  const numClean = numero
    ? String(numero).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 30)
    : ''

  const numPart = numClean
    ? (numClean.startsWith('FAC') ? numClean : `FAC-${numClean}`)
    : (facturaId ? `id${facturaId}` : `id${Date.now()}`)

  const base = provClean ? `${provClean}-${numPart}` : numPart

  return `${base}.${ext}`
}
