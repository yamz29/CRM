import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { rateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `Eres el asistente inteligente del CRM de Gonzalva Group, una constructora/remodeladora dominicana especializada en melamina.

Tu rol:
- Responder preguntas sobre los datos del sistema (proyectos, clientes, facturas, producción, etc.)
- Ayudar con cálculos rápidos y análisis de datos
- Sugerir acciones basadas en los datos del CRM
- Ser conciso y práctico — los usuarios son del equipo operativo

Reglas:
- Responde en español
- Usa formato corto, no más de 3-4 párrafos
- Los montos están en RD$ (pesos dominicanos)
- Si no tienes datos suficientes para responder, dilo directamente
- No inventes datos que no estén en el contexto proporcionado
- Puedes usar markdown para formato (negritas, listas, etc.)`

async function getCRMContext() {
  const [
    proyectos,
    clientes,
    facturas,
    oportunidades,
    ordenes,
    tareasPendientes,
  ] = await Promise.all([
    prisma.proyecto.findMany({
      select: { id: true, nombre: true, estado: true, presupuestoEstimado: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.cliente.count(),
    prisma.factura.groupBy({
      by: ['tipo', 'estado'],
      _sum: { total: true, montoPagado: true },
      _count: true,
    }),
    prisma.oportunidad.groupBy({
      by: ['etapa'],
      _count: true,
      _sum: { valor: true },
    }),
    prisma.ordenProduccion.findMany({
      where: { estado: { not: 'Completada' } },
      select: { id: true, codigo: true, nombre: true, estado: true, prioridad: true },
      take: 10,
    }).catch(() => []),
    prisma.tarea.count({ where: { estado: { not: 'completada' } } }).catch(() => 0),
  ])

  // Summarize facturas
  let totalIngresos = 0, totalEgresos = 0, porCobrar = 0, porPagar = 0
  for (const g of facturas) {
    const total = g._sum.total || 0
    const pagado = g._sum.montoPagado || 0
    if (g.estado === 'anulada') continue
    if (g.tipo === 'ingreso') {
      totalIngresos += total
      porCobrar += total - pagado
    } else {
      totalEgresos += total
      porPagar += total - pagado
    }
  }

  return `## Datos actuales del CRM

**Clientes:** ${clientes} registrados

**Proyectos activos (últimos 20):**
${proyectos.map(p => `- ${p.nombre} [${p.estado}] — Presupuesto: RD$ ${(p.presupuestoEstimado || 0).toLocaleString()}`).join('\n')}

**Pipeline de ventas:**
${oportunidades.map(o => `- ${o.etapa}: ${o._count} oportunidades — RD$ ${((o._sum.valor || 0)).toLocaleString()}`).join('\n')}

**Contabilidad:**
- Ingresos facturados: RD$ ${totalIngresos.toLocaleString()}
- Egresos facturados: RD$ ${totalEgresos.toLocaleString()}
- Por cobrar: RD$ ${porCobrar.toLocaleString()}
- Por pagar: RD$ ${porPagar.toLocaleString()}

**Tareas pendientes:** ${tareasPendientes}

${ordenes.length > 0 ? `**Órdenes de producción activas:**\n${ordenes.map(o => `- ${o.codigo}: ${o.nombre} [${o.estado}] — Prioridad: ${o.prioridad}`).join('\n')}` : ''}`
}

export const POST = withPermiso('dashboard', 'ver', async (request: NextRequest) => {
  // Cada request llama a Gemini y cuesta dinero. Límite por usuario:
  // 20/min para flujo conversacional normal, 300/día como tope económico.
  const limited = await rateLimit({ key: 'ai-chat', maxPerMinute: 20, maxPerDay: 300 })
  if (limited) return limited

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Asistente no disponible (API key no configurada)' },
        { status: 503 }
      )
    }

    const { message, history } = await request.json()
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    // Get CRM context
    const context = await getCRMContext()

    // Build conversation for Gemini
    const contents: any[] = []

    // System instruction via first user message
    contents.push({
      role: 'user',
      parts: [{ text: `${SYSTEM_PROMPT}\n\n${context}\n\n---\nResponde a las preguntas del usuario usando los datos anteriores como contexto.` }],
    })
    contents.push({
      role: 'model',
      parts: [{ text: 'Entendido. Soy el asistente del CRM de Gonzalva Group. ¿En qué puedo ayudarte?' }],
    })

    // Add conversation history (last 10 messages)
    if (history?.length) {
      for (const h of history.slice(-10)) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        })
      }
    }

    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] })

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}))
      console.error('Gemini error:', err)
      return NextResponse.json(
        { error: 'Error al consultar el asistente' },
        { status: 502 }
      )
    }

    const data = await geminiRes.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.'

    return NextResponse.json({ reply })
  } catch (error: any) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'Error interno del asistente' }, { status: 500 })
  }
})
