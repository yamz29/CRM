import { NextRequest, NextResponse } from 'next/server'
import Tesseract from 'tesseract.js'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

// Dominican invoice patterns
const PATTERNS = {
  // NCF: B01, B02, B14, B15, E31, E32, E33, E34, E41, E43, E44, E45, E46, E47
  ncf: /\b([BE]\d{2})\d{8,11}\b/i,
  ncfFull: /\b[BE]\d{10,13}\b/gi,
  // RNC: 9 digits (sometimes with dashes 1-01-12345-6)
  rnc: /\b(?:RNC[:\s]*)?(\d[\d-]{7,12}\d)\b/gi,
  rncClean: /\d{9,11}/,
  // Amounts: look for common patterns
  total: /(?:total|monto\s*total|total\s*general|total\s*a\s*pagar)[:\s]*(?:RD\$?|DOP)?\s*([\d,]+\.?\d*)/gi,
  subtotal: /(?:sub\s*total|subtotal|base\s*imponible)[:\s]*(?:RD\$?|DOP)?\s*([\d,]+\.?\d*)/gi,
  itbis: /(?:itbis|i\.t\.b\.i\.s|impuesto)[:\s]*(?:RD\$?|DOP)?\s*([\d,]+\.?\d*)/gi,
  // Invoice number
  factura: /(?:factura|fact|invoice|no\.|nro|número)[:\s#]*(\S+)/gi,
  // Date patterns
  fecha: /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g,
}

function parseAmount(str: string): number {
  return parseFloat(str.replace(/,/g, '')) || 0
}

function extractData(text: string) {
  const result: any = {
    ncf: null,
    rncProveedor: null,
    numero: null,
    subtotal: null,
    impuesto: null,
    total: null,
    fecha: null,
    rawText: text.substring(0, 2000), // first 2000 chars for debugging
  }

  // NCF
  const ncfMatches = text.match(PATTERNS.ncfFull)
  if (ncfMatches && ncfMatches.length > 0) {
    result.ncf = ncfMatches[0].toUpperCase()
  }

  // RNC — find all, first is usually the emisor (proveedor)
  const rncMatches: string[] = []
  let m
  while ((m = PATTERNS.rnc.exec(text)) !== null) {
    const cleaned = m[1].replace(/-/g, '')
    if (cleaned.length >= 9 && cleaned.length <= 11) {
      rncMatches.push(cleaned)
    }
  }
  if (rncMatches.length > 0) {
    result.rncProveedor = rncMatches[0]
  }

  // Total (take last match as it's usually the final total)
  const totals: number[] = []
  while ((m = PATTERNS.total.exec(text)) !== null) {
    totals.push(parseAmount(m[1]))
  }
  if (totals.length > 0) result.total = totals[totals.length - 1]

  // Subtotal
  while ((m = PATTERNS.subtotal.exec(text)) !== null) {
    result.subtotal = parseAmount(m[1])
  }

  // ITBIS
  while ((m = PATTERNS.itbis.exec(text)) !== null) {
    result.impuesto = parseAmount(m[1])
  }

  // If we have total but not subtotal, and we have itbis, derive it
  if (result.total && !result.subtotal && result.impuesto) {
    result.subtotal = result.total - result.impuesto
  }

  // Invoice number
  while ((m = PATTERNS.factura.exec(text)) !== null) {
    if (!result.numero) result.numero = m[1].replace(/[:#]/g, '').trim()
  }

  // Date
  const fechaMatches = text.match(PATTERNS.fecha)
  if (fechaMatches && fechaMatches.length > 0) {
    const parts = fechaMatches[0].split(/[\/\-.]/)
    const day = parseInt(parts[0])
    const month = parseInt(parts[1])
    let year = parseInt(parts[2])
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      result.fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return NextResponse.json({ error: 'OCR solo funciona con imágenes (JPG, PNG, WebP)' }, { status: 400 })
    }

    // Save to tmp
    await mkdir(TMP_DIR, { recursive: true })
    const tmpPath = path.join(TMP_DIR, `ocr-${Date.now()}.${ext}`)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(tmpPath, buffer)

    try {
      // Run OCR
      const { data } = await Tesseract.recognize(tmpPath, 'spa', {
        logger: () => {},
      })

      const extracted = extractData(data.text)

      return NextResponse.json({
        success: true,
        confidence: data.confidence,
        extracted,
      })
    } finally {
      // Cleanup tmp file
      try { await unlink(tmpPath) } catch {}
    }
  } catch (error) {
    console.error('Error OCR:', error)
    return NextResponse.json({ error: 'Error al procesar imagen' }, { status: 500 })
  }
}
