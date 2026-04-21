/**
 * Compresión y pre-procesamiento de imágenes en el cliente.
 *
 * Dos funciones con propósitos distintos:
 *
 *   compressImage(file)     → versión liviana para subir al servidor (upload +
 *                             almacenamiento). Comprime agresivo, máx 1600px,
 *                             q=0.85, ~300-700KB.
 *
 *   enhanceForOCR(file)     → versión pre-procesada para Gemini/Claude Vision.
 *                             Corrige orientación EXIF, aumenta contraste,
 *                             mantiene resolución alta (hasta 2200px), q=0.92.
 *                             Resultado ~500KB-1MB pero mucho más legible.
 *
 * Ambas son tolerantes a fallos: si algo sale mal, retornan el archivo original.
 */

export interface CompressOptions {
  maxDimension?: number
  quality?: number
  maxSizeBytes?: number
}

// ═════════════════════════════════════════════════════════════════════
// Versión básica para upload
// ═════════════════════════════════════════════════════════════════════

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const {
    maxDimension = 1600,
    quality = 0.85,
    maxSizeBytes = 1024 * 1024,
  } = opts

  const compressible = ['image/jpeg', 'image/png', 'image/webp']
  if (!compressible.includes(file.type)) return file
  if (file.size <= maxSizeBytes) return file

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = bitmap
    let w = width, h = height
    const maxSide = Math.max(width, height)
    if (maxSide > maxDimension) {
      const scale = maxDimension / maxSide
      w = Math.round(width * scale)
      h = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (err) {
    console.warn('compressImage falló, usando original:', err)
    return file
  }
}

// ═════════════════════════════════════════════════════════════════════
// Versión mejorada para OCR
// ═════════════════════════════════════════════════════════════════════

/**
 * Auto-contraste por estiramiento de histograma con clipping de percentiles.
 *
 * 1. Calcula histograma de luminancia
 * 2. Encuentra valores en percentil 1 y 99
 * 3. Remapea linealmente [p1, p99] → [0, 255]
 *
 * Esto hace que texto apagado (gris sobre gris) se vea como negro sobre
 * blanco. Para fotos bien expuestas el efecto es mínimo.
 */
function autoContrast(data: Uint8ClampedArray) {
  const histR = new Array(256).fill(0)
  const histG = new Array(256).fill(0)
  const histB = new Array(256).fill(0)
  const len = data.length

  for (let i = 0; i < len; i += 4) {
    histR[data[i]]++
    histG[data[i + 1]]++
    histB[data[i + 2]]++
  }

  const totalPixels = len / 4
  const clip = Math.floor(totalPixels * 0.005) // clip 0.5% en cada extremo

  const findBound = (hist: number[], reverse: boolean): number => {
    let acc = 0
    if (!reverse) {
      for (let i = 0; i < 256; i++) {
        acc += hist[i]
        if (acc > clip) return i
      }
      return 0
    } else {
      for (let i = 255; i >= 0; i--) {
        acc += hist[i]
        if (acc > clip) return i
      }
      return 255
    }
  }

  const minR = findBound(histR, false), maxR = findBound(histR, true)
  const minG = findBound(histG, false), maxG = findBound(histG, true)
  const minB = findBound(histB, false), maxB = findBound(histB, true)

  const scaleR = maxR > minR ? 255 / (maxR - minR) : 1
  const scaleG = maxG > minG ? 255 / (maxG - minG) : 1
  const scaleB = maxB > minB ? 255 / (maxB - minB) : 1

  for (let i = 0; i < len; i += 4) {
    data[i]     = Math.max(0, Math.min(255, (data[i] - minR) * scaleR))
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - minG) * scaleG))
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - minB) * scaleB))
    // alpha (data[i+3]) sin tocar
  }
}

/**
 * Enfoca la imagen con un kernel unsharp mask ligero.
 * Ayuda cuando el texto está ligeramente desenfocado.
 */
function applyUnsharp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Implementación simple: mezcla imagen original con versión más contrastada
  // usando un kernel 3x3. Evitamos convolución completa por performance.
  const img = ctx.getImageData(0, 0, w, h)
  const src = img.data
  const out = new Uint8ClampedArray(src.length)
  out.set(src)

  // Kernel de sharpening suave:
  //   0 -1  0
  //  -1  5 -1
  //   0 -1  0
  // Aplicado por canal
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = src[i + c]
        const up    = src[i - w * 4 + c]
        const down  = src[i + w * 4 + c]
        const left  = src[i - 4 + c]
        const right = src[i + 4 + c]
        const sharp = 5 * center - up - down - left - right
        // Mezcla 70% original + 30% sharp para no pasarse
        const mixed = 0.7 * center + 0.3 * sharp
        out[i + c] = Math.max(0, Math.min(255, mixed))
      }
    }
  }

  ctx.putImageData(new ImageData(out, w, h), 0, 0)
}

export interface EnhanceOptions {
  maxDimension?: number
  quality?: number
  sharpen?: boolean
}

/**
 * Prepara una imagen para OCR:
 * 1. Lee con orientación EXIF aplicada (corrige fotos iOS rotadas).
 * 2. Escala a máx 2200px (resolución alta → modelos leen mejor).
 * 3. Aplica auto-contraste (estiramiento de histograma).
 * 4. Opcionalmente enfoca un poco (sharpen).
 * 5. Exporta como JPEG q=0.92.
 *
 * Para PDFs retorna el original (no se puede procesar sin renderizar).
 */
export async function enhanceForOCR(
  file: File,
  opts: EnhanceOptions = {}
): Promise<File> {
  const { maxDimension = 2200, quality = 0.92, sharpen = true } = opts

  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/gif') return file // no procesar animados

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = bitmap

    let w = width, h = height
    const maxSide = Math.max(width, height)
    if (maxSide > maxDimension) {
      const scale = maxDimension / maxSide
      w = Math.round(width * scale)
      h = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    // Auto-contraste
    try {
      const imgData = ctx.getImageData(0, 0, w, h)
      autoContrast(imgData.data)
      ctx.putImageData(imgData, 0, 0)
    } catch (e) {
      console.warn('Auto-contraste falló:', e)
    }

    // Sharpening (opcional, puede ser lento en imágenes grandes)
    if (sharpen && w * h < 2_500_000) {
      try { applyUnsharp(ctx, w, h) }
      catch (e) { console.warn('Sharpen falló:', e) }
    }

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    })
    if (!blob) return file

    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}-ocr.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (err) {
    console.warn('enhanceForOCR falló, usando original:', err)
    return file
  }
}
