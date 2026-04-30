import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

/**
 * GET /api/notifications/vapid-public-key
 *
 * Devuelve la VAPID_PUBLIC_KEY que el frontend necesita para suscribirse al
 * push manager del navegador. Es público en el sentido de que se incluye en
 * la subscription que el navegador genera, pero el endpoint igual requiere
 * usuario autenticado para no exponerla a scrapers.
 */
export const GET = withPermiso('dashboard', 'ver', async (_req: NextRequest) => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'VAPID no configurado en el servidor', configured: false },
      { status: 503 }
    )
  }
  return NextResponse.json({ key, configured: true })
})
