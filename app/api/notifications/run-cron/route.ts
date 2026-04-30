import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { correrNotificacionesDiarias } from '@/lib/notificaciones-cron'

/**
 * POST /api/notifications/run-cron
 *
 * Dispara manualmente el job diario de notificaciones (facturas
 * vencidas/venciendo + cronogramas atrasados). Útil para probar y para
 * disparar desde un cron externo del sistema si se quiere mayor
 * confiabilidad que el setTimeout interno.
 *
 * Solo Admin.
 */
export const POST = withPermiso('configuracion', 'editar', async (req: NextRequest) => {
  const rol = req.headers.get('x-user-rol')
  if (rol !== 'Admin') {
    return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
  }

  const result = await correrNotificacionesDiarias()
  return NextResponse.json({ ok: true, ...result })
})
