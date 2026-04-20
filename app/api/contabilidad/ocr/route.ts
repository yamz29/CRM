import { NextRequest, NextResponse } from 'next/server'
import { checkPermiso } from '@/lib/permisos'

// Modelo configurable vía env (default: gemini-2.5-pro para mejor precisión
// visual en facturas). Alternativas: gemini-2.5-flash (más rápido/barato).
const GEMINI_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-pro'

const GEMINI_PROMPT = `Eres un asistente experto en facturas dominicanas (República Dominicana).
Analiza cuidadosamente la imagen/PDF y extrae los campos en JSON.

IMPORTANTE:
- Si no puedes leer un campo con CERTEZA, ponlo como null. No inventes nunca.
- Los montos vienen en pesos dominicanos (RD$). Devuelve solo el número (sin símbolo ni comas).
- El NCF es el comprobante fiscal, formato estricto: empieza con B o E seguido de 10-11 dígitos (ej: B0100000123, E310000001). Si ves "NCF", "Comprobante Fiscal", "e-CF", búscalo ahí.
- El RNC es el identificador tributario del proveedor (9-11 dígitos, sin guiones). Puede estar cerca del nombre del emisor, como "RNC: 123456789" o "Cédula/RNC".
- Fechas en formato YYYY-MM-DD (ej: 2026-04-20).
- "Fecha" es la fecha de emisión. Si hay "Vencimiento", "Vence" o "Fecha Vencimiento", captúrala también.
- El "subtotal" es sin ITBIS. El "impuesto" es el ITBIS (normalmente 18%). El "total" es subtotal + ITBIS.
- Si solo hay "total" sin desglose, pon subtotal y impuesto en null, solo total.
- El "proveedor" es el nombre de la empresa que emite la factura (no el cliente al que va dirigida).
- Descripción: resume en máximo 80 caracteres los productos/servicios. Si hay varios, menciona los principales.

Campos a extraer:
{
  "ncf": string|null,
  "rncProveedor": string|null,
  "proveedor": string|null,
  "numero": string|null,
  "fecha": string|null,
  "fechaVencimiento": string|null,
  "subtotal": number|null,
  "impuesto": number|null,
  "total": number|null,
  "descripcion": string|null
}

Responde ÚNICAMENTE con el JSON válido, sin markdown, sin comentarios, sin texto antes o después.`

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY no configurada en el servidor' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('archivo') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Solo se aceptan imágenes (JPG, PNG, WebP) o PDF' },
        { status: 400 }
      )
    }

    // Límite 10MB. Gemini acepta hasta ~20MB en inlineData.
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande (máx. 10MB)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_PROMPT },
            {
              inlineData: {
                mimeType: file.type,
                data: base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1, // Baja creatividad → mayor consistencia
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}))
      console.error('Gemini API error:', geminiRes.status, errData)
      return NextResponse.json(
        { error: `Error de Gemini: ${errData?.error?.message || geminiRes.statusText}` },
        { status: 502 }
      )
    }

    const geminiData = await geminiRes.json()
    const textResponse: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // responseMimeType debería retornar JSON válido, pero saneamos por si
    const cleanJson = textResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(cleanJson)
    } catch {
      console.error('Failed to parse Gemini response:', textResponse.slice(0, 500))
      return NextResponse.json(
        { error: 'No se pudo interpretar la respuesta del OCR', raw: textResponse.slice(0, 500) },
        { status: 500 }
      )
    }

    // Normalizar numéricos (por si Gemini devuelve strings "1,525.50")
    const toNum = (v: unknown): number | null => {
      if (v == null) return null
      if (typeof v === 'number') return isNaN(v) ? null : v
      const s = String(v).replace(/[^\d.,-]/g, '').replace(/,(\d{3})/g, '$1').replace(',', '.')
      const n = parseFloat(s)
      return isNaN(n) ? null : n
    }
    extracted.subtotal = toNum(extracted.subtotal)
    extracted.impuesto = toNum(extracted.impuesto)
    extracted.total    = toNum(extracted.total)

    const toStr = (v: unknown): string | null => {
      if (v == null) return null
      const s = String(v).trim()
      return s.length > 0 ? s : null
    }
    extracted.ncf              = toStr(extracted.ncf)
    extracted.rncProveedor     = toStr(extracted.rncProveedor)
    extracted.proveedor        = toStr(extracted.proveedor)
    extracted.numero           = toStr(extracted.numero)
    extracted.fecha            = toStr(extracted.fecha)
    extracted.fechaVencimiento = toStr(extracted.fechaVencimiento)
    extracted.descripcion      = toStr(extracted.descripcion)

    return NextResponse.json({
      success: true,
      model: GEMINI_MODEL,
      extracted,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'desconocido'
    console.error('Error OCR:', error)
    return NextResponse.json(
      { error: `Error al procesar archivo: ${msg}` },
      { status: 500 }
    )
  }
}
