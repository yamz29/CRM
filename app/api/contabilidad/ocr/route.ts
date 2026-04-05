import { NextRequest, NextResponse } from 'next/server'

const GEMINI_PROMPT = `Analiza esta imagen de una factura dominicana y extrae los siguientes campos en formato JSON.
Si no puedes identificar un campo, ponlo como null. NO inventes datos.

Campos a extraer:
- ncf: Número de Comprobante Fiscal (formato B01XXXXXXXX o E31XXXXXXXX, 11-13 caracteres empezando con B o E)
- rncProveedor: RNC del emisor/proveedor (9-11 dígitos, sin guiones)
- proveedor: Nombre del proveedor/empresa que emite la factura
- numero: Número de factura o documento
- fecha: Fecha de la factura en formato YYYY-MM-DD
- subtotal: Monto subtotal (sin impuestos), solo número
- impuesto: Monto ITBIS/impuesto, solo número
- total: Monto total, solo número
- descripcion: Breve descripción de lo que se factura (máx 100 caracteres)

Responde SOLO con el JSON, sin markdown ni texto adicional. Ejemplo:
{"ncf":"B0100000001","rncProveedor":"123456789","proveedor":"Empresa XYZ","numero":"FAC-001","fecha":"2026-01-15","subtotal":1000,"impuesto":180,"total":1180,"descripcion":"Materiales de construcción"}`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY no configurada. Agrega la variable de entorno.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('archivo') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validate file type (images + PDF)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Solo se aceptan imágenes (JPG, PNG, WebP) o PDF' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    // Call Gemini Vision API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

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
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}))
      console.error('Gemini API error:', geminiRes.status, errData)
      return NextResponse.json(
        { error: `Error de Gemini API: ${errData?.error?.message || geminiRes.statusText}` },
        { status: 502 }
      )
    }

    const geminiData = await geminiRes.json()
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse the JSON response from Gemini
    // Clean up potential markdown code blocks
    const cleanJson = textResponse
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    let extracted: any
    try {
      extracted = JSON.parse(cleanJson)
    } catch {
      console.error('Failed to parse Gemini response:', textResponse)
      return NextResponse.json(
        { error: 'No se pudo interpretar la respuesta del OCR' },
        { status: 500 }
      )
    }

    // Normalize numeric fields
    if (extracted.subtotal) extracted.subtotal = parseFloat(extracted.subtotal) || null
    if (extracted.impuesto) extracted.impuesto = parseFloat(extracted.impuesto) || null
    if (extracted.total) extracted.total = parseFloat(extracted.total) || null

    return NextResponse.json({
      success: true,
      extracted,
    })
  } catch (error: any) {
    console.error('Error OCR:', error)
    return NextResponse.json(
      { error: `Error al procesar imagen: ${error.message || 'desconocido'}` },
      { status: 500 }
    )
  }
}
