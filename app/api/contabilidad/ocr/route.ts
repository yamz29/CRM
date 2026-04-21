import { NextRequest, NextResponse } from 'next/server'
import { checkPermiso } from '@/lib/permisos'

// Timeout del OCR en ms. Claude vision con imágenes grandes puede tardar
// 20-60s. Si nginx tiene proxy_read_timeout menor (default 60s), la request
// muere antes. Fijar aquí un timeout que cabe dentro del de nginx (120s).
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 90_000

// Aumenta el maxDuration de la función de ruta (Next.js config)
export const maxDuration = 120 // segundos

// Provider configurable vía env. Claude tiene mejor precisión en fotos
// de facturas borrosas/anguladas que Gemini. Default: claude.
// Valores: 'claude' | 'gemini'
const OCR_PROVIDER = (process.env.OCR_PROVIDER || 'claude').toLowerCase()

// Modelos configurables (permite ajustar sin redeploy).
const GEMINI_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-pro'
const CLAUDE_MODEL = process.env.CLAUDE_OCR_MODEL || 'claude-sonnet-4-5-20250929'

const PROMPT = `Eres un asistente experto en facturas dominicanas (República Dominicana).
Analiza cuidadosamente la imagen/PDF y extrae los campos en JSON.

REGLAS GENERALES:
- Si no puedes leer un campo con CERTEZA, ponlo como null. No inventes nunca.
- Los montos vienen en pesos dominicanos (RD$). Devuelve solo el número (sin símbolo ni comas, sin texto).
- Fechas en formato YYYY-MM-DD estricto (ej: 2026-04-20). Si no puedes, null.

IDENTIFICACIÓN:
- NCF: comprobante fiscal. Formato estricto: empieza con B o E seguido de 10-11 dígitos (ej: B0100000123, E310000001). Busca "NCF", "Comprobante Fiscal", "e-CF".
- RNC del proveedor: 9-11 dígitos sin guiones. Busca "RNC:", "Cédula/RNC".
- Proveedor: nombre de la empresa que EMITE la factura (no el cliente).

IMPUESTOS DOMINICANOS (IMPORTANTE):
- ITBIS: tasa 18% (general), 16% (reducida) o 0% (exento). Devuelve el MONTO en "impuesto" y la TASA en "tasaItbis" (18, 16 o 0).
- Propina Legal 10% (Ley 228): OBLIGATORIA en restaurantes, hoteles, cafés y bares.
  Busca líneas "Propina Legal", "10% Ley", "Servicio 10%", "Ley 228". Va en "propinaLegal".
  NO confundir con "Propina Sugerida" o "Tip" voluntarios — esos se ignoran (null).
- Otros impuestos (ISC, CDT turístico, selectivo): van en "otrosImpuestos" sumados.

DESGLOSE DE MONTOS:
- subtotal: monto SIN impuestos ni propina ni otros.
- impuesto: solo ITBIS.
- propinaLegal: solo si es la propina legal 10% (no voluntaria).
- otrosImpuestos: ISC, CDT, selectivo, etc.
- total: lo que paga el cliente final. Debe ser subtotal + impuesto + propinaLegal + otrosImpuestos.

Si solo hay "total" sin desglose, deja subtotal/impuesto/propinaLegal en null — el usuario lo desglosará. No asumas valores.

Descripción: resume en máximo 60 caracteres los productos/servicios principales.
Obligatorio terminar palabras completas y cerrar el JSON correctamente con }.

Campos a extraer:
{
  "ncf": string|null,
  "rncProveedor": string|null,
  "proveedor": string|null,
  "numero": string|null,
  "fecha": string|null,
  "fechaVencimiento": string|null,
  "subtotal": number|null,
  "tasaItbis": number|null,
  "impuesto": number|null,
  "propinaLegal": number|null,
  "otrosImpuestos": number|null,
  "total": number|null,
  "descripcion": string|null
}

Responde ÚNICAMENTE con el JSON válido, sin markdown, sin comentarios, sin texto antes o después.`

// ═══════════════════════════════════════════════════════════════════════
// CLAUDE (Anthropic)
// ═══════════════════════════════════════════════════════════════════════

async function ocrClaude(
  apiKey: string,
  mimeType: string,
  base64: string,
  model: string,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS)
  try {
    // PDFs usan beta header; imágenes van normal.
    const isPdf = mimeType === 'application/pdf'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(isPdf ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            isPdf
              ? {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: base64 },
                }
              : {
                  type: 'image',
                  source: { type: 'base64', media_type: mimeType, data: base64 },
                },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Claude ${res.status}: ${err?.error?.message || res.statusText}`)
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text || ''
    return text
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error(`Claude tardó más de ${OCR_TIMEOUT_MS / 1000}s`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GEMINI
// ═══════════════════════════════════════════════════════════════════════

async function ocrGemini(
  apiKey: string,
  mimeType: string,
  base64: string,
  model: string,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Gemini ${res.status}: ${err?.error?.message || res.statusText}`)
    }

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return text
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      throw new Error(`Gemini tardó más de ${OCR_TIMEOUT_MS / 1000}s`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Handler
// ═══════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
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
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande (máx. 10MB)' },
        { status: 400 }
      )
    }

    // Provider puede venir forzado por query (?provider=claude|gemini)
    // para pruebas/reintentos. Default: OCR_PROVIDER env var.
    const requestedProvider = request.nextUrl.searchParams.get('provider')?.toLowerCase()
    const provider = requestedProvider && ['claude', 'gemini'].includes(requestedProvider)
      ? requestedProvider
      : OCR_PROVIDER

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    let textResponse = ''
    let modelUsed = ''
    try {
      if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
        textResponse = await ocrGemini(apiKey, file.type, base64, GEMINI_MODEL)
        modelUsed = GEMINI_MODEL
      } else {
        // claude (default)
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada')
        textResponse = await ocrClaude(apiKey, file.type, base64, CLAUDE_MODEL)
        modelUsed = CLAUDE_MODEL
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error del proveedor'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    // Parseo robusto: Claude/Gemini a veces incluyen texto antes o después
    // del JSON, markdown fences, o incluso comentarios //
    let extracted: Record<string, unknown> | null = null

    const tryParse = (s: string) => {
      try { return JSON.parse(s) } catch { return null }
    }

    // Intento 1: directo
    extracted = tryParse(textResponse.trim())

    // Intento 2: quitar code fences
    if (!extracted) {
      const noFences = textResponse
        .replace(/```(?:json|JSON)?\s*/g, '')
        .replace(/```/g, '')
        .trim()
      extracted = tryParse(noFences)
    }

    // Intento 3: extraer bloque {...} más grande
    if (!extracted) {
      const start = textResponse.indexOf('{')
      const end = textResponse.lastIndexOf('}')
      if (start >= 0 && end > start) {
        extracted = tryParse(textResponse.slice(start, end + 1))
      }
    }

    // Intento 4: remover comentarios de línea // y trailing commas
    if (!extracted) {
      const sanitized = textResponse
        .replace(/\/\/[^\n]*/g, '')
        .replace(/,(\s*[}\]])/g, '$1')
      const start = sanitized.indexOf('{')
      const end = sanitized.lastIndexOf('}')
      if (start >= 0 && end > start) {
        extracted = tryParse(sanitized.slice(start, end + 1))
      }
    }

    if (!extracted) {
      console.error('Failed to parse OCR response. Raw:', textResponse.slice(0, 1000))
      return NextResponse.json(
        {
          error: 'No se pudo interpretar la respuesta del OCR',
          provider,
          model: modelUsed,
          raw: textResponse.slice(0, 1500),
        },
        { status: 500 }
      )
    }

    // Normalización de campos numéricos
    const toNum = (v: unknown): number | null => {
      if (v == null) return null
      if (typeof v === 'number') return isNaN(v) ? null : v
      const s = String(v).replace(/[^\d.,-]/g, '').replace(/,(\d{3})/g, '$1').replace(',', '.')
      const n = parseFloat(s)
      return isNaN(n) ? null : n
    }
    extracted.subtotal        = toNum(extracted.subtotal)
    extracted.tasaItbis       = toNum(extracted.tasaItbis)
    extracted.impuesto        = toNum(extracted.impuesto)
    extracted.propinaLegal    = toNum(extracted.propinaLegal)
    extracted.otrosImpuestos  = toNum(extracted.otrosImpuestos)
    extracted.total           = toNum(extracted.total)

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
      provider,
      model: modelUsed,
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
