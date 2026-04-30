import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

/**
 * POST /api/notifications/unsubscribe
 * Body: { endpoint }
 *
 * Elimina la PushSubscription del navegador (cuando el user desactiva
 * notificaciones desde el botón en la UI). El endpoint es público dentro
 * de una sub, así que no es secreto pero igual requerimos autenticación.
 */
export const POST = withPermiso('dashboard', 'ver', async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
})
