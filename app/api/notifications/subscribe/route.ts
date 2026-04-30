import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

/**
 * POST /api/notifications/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * Registra (o actualiza) la PushSubscription del navegador del usuario
 * autenticado. Idempotente: si el endpoint ya existe, lo asocia al usuario
 * actual y refresca las keys (útil si el user borró cookies y volvió a
 * suscribirse, o si la subscription se renovó).
 */
export const POST = withPermiso('dashboard', 'ver', async (req: NextRequest) => {
  const userIdHeader = req.headers.get('x-user-id')
  const usuarioId = userIdHeader ? parseInt(userIdHeader) : NaN
  if (isNaN(usuarioId)) {
    return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  const userAgent = body?.userAgent ?? req.headers.get('user-agent') ?? null

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'subscription inválida' }, { status: 400 })
  }

  // upsert por endpoint (único). Si ya existía con otro user, lo robamos
  // — caso típico: dispositivo compartido entre 2 logins consecutivos.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { usuarioId, endpoint, p256dh, auth, userAgent },
    update: { usuarioId, p256dh, auth, userAgent },
  })

  return NextResponse.json({ ok: true })
})
