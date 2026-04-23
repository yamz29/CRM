import { NextResponse } from 'next/server'
import { getSession } from './auth'

/**
 * Rate limiter en memoria por (usuario, key).
 *
 * In-memory alcanza para un solo proceso Node — si algún día escalamos a
 * múltiples réplicas, hay que migrar a Redis o a tabla en DB. Por ahora
 * (ERP interno con ~decenas de usuarios concurrentes) es suficiente.
 *
 * Protege APIs que cuestan dinero (OCR de facturas con Claude/Gemini,
 * chat con LLM) contra loops accidentales o abuso intencional de un
 * usuario autenticado.
 */

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// GC barato: recorre el Map cada minuto y limpia buckets vencidos.
let gcStarted = false
function startGc() {
  if (gcStarted) return
  gcStarted = true
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k)
    }
  }, 60_000)
  // No bloquees el shutdown de Node por este timer.
  if (typeof timer.unref === 'function') timer.unref()
}

interface RateLimitOptions {
  /** Identifica el recurso (ej: "ocr", "ai-chat"). */
  key: string
  /** Máximo de solicitudes por minuto por usuario. */
  maxPerMinute: number
  /** Opcional: máximo por día (p.ej. para OCR que cuesta por request). */
  maxPerDay?: number
}

/**
 * Verifica si el usuario autenticado actual puede ejecutar otra llamada
 * al recurso `key`. Devuelve `null` si está dentro del límite, o un
 * `NextResponse` 429 con `Retry-After` si lo excedió.
 *
 * Uso típico dentro de un handler ya envuelto en `withPermiso`:
 *
 * ```ts
 * export const POST = withPermiso('contabilidad', 'editar', async (req) => {
 *   const limited = await rateLimit({ key: 'ocr', maxPerMinute: 20, maxPerDay: 200 })
 *   if (limited) return limited
 *   // ... lógica normal ...
 * })
 * ```
 */
export async function rateLimit(opts: RateLimitOptions): Promise<NextResponse | null> {
  startGc()

  const session = await getSession()
  // Si no hay sesión, no aplicamos rate-limit aquí — withPermiso ya bloqueó.
  if (!session) return null

  const now = Date.now()
  const userId = session.id

  // ── ventana por minuto ────────────────────────────────────────────────
  const minKey = `${userId}:${opts.key}:min`
  let minBucket = buckets.get(minKey)
  if (!minBucket || minBucket.resetAt < now) {
    minBucket = { count: 0, resetAt: now + 60_000 }
    buckets.set(minKey, minBucket)
  }
  minBucket.count++
  if (minBucket.count > opts.maxPerMinute) {
    const retry = Math.max(1, Math.ceil((minBucket.resetAt - now) / 1000))
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Intenta de nuevo en ${retry}s.` },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  // ── ventana diaria (opcional) ─────────────────────────────────────────
  if (opts.maxPerDay) {
    const dayKey = `${userId}:${opts.key}:day`
    let dayBucket = buckets.get(dayKey)
    if (!dayBucket || dayBucket.resetAt < now) {
      dayBucket = { count: 0, resetAt: now + 86_400_000 }
      buckets.set(dayKey, dayBucket)
    }
    dayBucket.count++
    if (dayBucket.count > opts.maxPerDay) {
      const retryHours = Math.ceil((dayBucket.resetAt - now) / 3_600_000)
      return NextResponse.json(
        { error: `Límite diario de ${opts.maxPerDay} solicitudes excedido. Restablece en ~${retryHours}h.` },
        { status: 429, headers: { 'Retry-After': String(retryHours * 3600) } }
      )
    }
  }

  return null
}
