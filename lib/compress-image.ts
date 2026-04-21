/**
 * Compresión de imágenes en el cliente (browser) antes de subirlas.
 *
 * Fotos de iPhone/Android capturadas desde la cámara pueden pesar 5–10MB.
 * Para facturas solo necesitamos que Gemini pueda leerlas — 1600px de ancho
 * máximo con JPEG q=0.85 suele dar archivos de 300–700KB, legibles OCR.
 *
 * Retorna:
 *  - El mismo File si es PDF, GIF, o ya es pequeño.
 *  - Un nuevo File (JPEG comprimido) si es imagen grande.
 *
 * Uso:
 *   const f = await compressImage(originalFile)
 *   formData.append('archivo', f)
 */

export interface CompressOptions {
  maxDimension?: number  // px máx de lado más largo. Default 1600.
  quality?: number       // 0–1. Default 0.85.
  maxSizeBytes?: number  // Si el original pesa menos, no compresa. Default 1MB.
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const {
    maxDimension = 1600,
    quality = 0.85,
    maxSizeBytes = 1024 * 1024,
  } = opts

  // Solo comprimimos JPG/PNG/WebP. PDFs y GIFs van tal cual.
  const compressible = ['image/jpeg', 'image/png', 'image/webp']
  if (!compressible.includes(file.type)) return file

  // Si ya es chico, no compensa
  if (file.size <= maxSizeBytes) return file

  try {
    // Cargar la imagen en un bitmap
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    // Calcular dimensiones nuevas preservando aspect ratio
    let w = width, h = height
    const maxSide = Math.max(width, height)
    if (maxSide > maxDimension) {
      const scale = maxDimension / maxSide
      w = Math.round(width * scale)
      h = Math.round(height * scale)
    }

    // Dibujar en un canvas
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    // Exportar como JPEG (más pequeño que PNG)
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blob) return file

    // Si por alguna razón la "comprimida" pesa más que el original, retornar original
    if (blob.size >= file.size) return file

    // Mantener nombre con .jpg y mimeType jpeg
    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (err) {
    console.warn('compressImage falló, usando original:', err)
    return file
  }
}
