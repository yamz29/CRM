import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { rateLimit } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }

const SYSTEM_PROMPT = `Eres un asistente experto en presupuestos de obra y carpintería de melamina para Gonzalva Group, una constructora dominicana.

Tu tarea es generar un RESUMEN EJECUTIVO claro y útil del presupuesto que se te entrega, para que el equipo comercial entienda de un vistazo qué incluye sin tener que leer todas las partidas.

Reglas:
- Responde en español, tono profesional pero directo.
- Usa markdown: párrafos cortos y listas con viñetas.
- Estructura: (1) un párrafo inicial describiendo el alcance global del trabajo, (2) una lista con los principales bloques/capítulos y lo más relevante de cada uno, (3) si hay módulos de melamina o cocinas, mencionar cuántos y de qué tipo.
- Los montos están en RD$ (pesos dominicanos). Menciona el total general al final.
- NO inventes nada que no esté en los datos. Si una sección está vacía, omítela.
- NO repitas literalmente la lista de partidas — sintetiza por categorías.
- Máximo 250 palabras.`

function formatRD(n: number) {
  return 'RD$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const POST = withPermiso('presupuestos', 'editar', async (_request: NextRequest, { params }: Params) => {
  // Genera el resumen IA con Gemini — cuesta por request. Límite conservador
  // porque típicamente se usa 1-2 veces por presupuesto: 5/min, 50/día.
  const limited = await rateLimit({ key: 'resumen-ia', maxPerMinute: 5, maxPerDay: 50 })
  if (limited) return limited

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Asistente IA no disponible (API key no configurada)' }, { status: 503 })
    }

    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        cliente: { select: { nombre: true } },
        proyecto: { select: { nombre: true, tipoProyecto: true, ubicacion: true } },
        titulos: { orderBy: { orden: 'asc' } },
        capitulos: {
          orderBy: { orden: 'asc' },
          include: { partidas: { orderBy: { orden: 'asc' } } },
        },
        modulosMelamina: { orderBy: { orden: 'asc' } },
        partidas: { orderBy: { orden: 'asc' } },
        indirectos: { where: { activo: true } },
      },
    })
    if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

    // ── Build the structured context ────────────────────────────────────────
    const lines: string[] = []
    lines.push(`# Presupuesto ${presupuesto.numero}`)
    lines.push(`Cliente: ${presupuesto.cliente.nombre}`)
    if (presupuesto.proyecto) {
      lines.push(`Proyecto: ${presupuesto.proyecto.nombre}` +
        (presupuesto.proyecto.tipoProyecto ? ` (${presupuesto.proyecto.tipoProyecto})` : '') +
        (presupuesto.proyecto.ubicacion ? ` — ${presupuesto.proyecto.ubicacion}` : ''))
    }
    lines.push(`Estado: ${presupuesto.estado}`)
    lines.push(`Total general: ${formatRD(presupuesto.total)}`)
    lines.push('')

    // Map titulo IDs to names for grouping
    const tituloById = new Map(presupuesto.titulos.map(t => [t.id, t.nombre]))

    // Group capitulos by titulo
    if (presupuesto.capitulos.length > 0) {
      lines.push('## Capítulos y partidas')
      // Group by tituloId
      const grouped: Record<string, typeof presupuesto.capitulos> = {}
      for (const cap of presupuesto.capitulos) {
        const key = cap.tituloId != null ? String(cap.tituloId) : 'sin-titulo'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(cap)
      }
      for (const [key, caps] of Object.entries(grouped)) {
        if (key !== 'sin-titulo') {
          const tituloNombre = tituloById.get(parseInt(key)) || 'Título'
          lines.push(`\n### ${tituloNombre}`)
        }
        for (const cap of caps) {
          const capTotal = cap.partidas.reduce((a, p) => a + (p.esNota ? 0 : p.subtotal), 0)
          lines.push(`\n**${cap.codigo ? cap.codigo + ' - ' : ''}${cap.nombre}** — ${formatRD(capTotal)}`)
          for (const p of cap.partidas) {
            if (p.esNota) {
              lines.push(`  · (nota) ${p.descripcion}`)
            } else {
              lines.push(`  - ${p.descripcion} | ${p.cantidad} ${p.unidad} × ${formatRD(p.precioUnitario)} = ${formatRD(p.subtotal)}`)
            }
          }
        }
      }
      lines.push('')
    }

    // Legacy partidas (old format)
    if (presupuesto.partidas.length > 0) {
      lines.push('## Partidas (formato legado)')
      for (const p of presupuesto.partidas) {
        lines.push(`- ${p.descripcion} | ${p.cantidad} ${p.unidad} = ${formatRD(p.subtotal)}`)
      }
      lines.push('')
    }

    // Modulos melamina
    if (presupuesto.modulosMelamina.length > 0) {
      lines.push('## Módulos de melamina')
      for (const m of presupuesto.modulosMelamina) {
        lines.push(`- ${m.cantidad}× ${m.tipoModulo}: ${m.descripcion} (${m.ancho}×${m.alto}×${m.profundidad} cm) = ${formatRD(m.subtotal * m.cantidad)}`)
      }
      lines.push('')
    }

    // Indirectos
    if (presupuesto.indirectos.length > 0) {
      lines.push('## Gastos indirectos activos')
      for (const i of presupuesto.indirectos) {
        lines.push(`- ${i.nombre}: ${i.porcentaje}%`)
      }
      lines.push('')
    }

    if (presupuesto.notas) {
      lines.push('## Notas del presupuesto')
      lines.push(presupuesto.notas)
    }

    const contextText = lines.join('\n')

    // ── Call Gemini ─────────────────────────────────────────────────────────
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\n---\nDatos del presupuesto:\n\n${contextText}\n\n---\nGenera el resumen ejecutivo ahora.` }],
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
        },
      }),
    })

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}))
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error al consultar el asistente IA' }, { status: 502 })
    }

    const data = await geminiRes.json()
    const resumen = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!resumen) {
      return NextResponse.json({ error: 'La IA no devolvió contenido' }, { status: 502 })
    }

    // ── Save to DB ──────────────────────────────────────────────────────────
    await prisma.presupuesto.update({
      where: { id },
      data: { resumenIA: resumen, resumenIAGeneradoAt: new Date() },
    })

    return NextResponse.json({ resumen, generadoAt: new Date().toISOString() })
  } catch (error) {
    console.error('Error generando resumen IA:', error)
    return NextResponse.json({ error: 'Error interno al generar el resumen' }, { status: 500 })
  }
})
