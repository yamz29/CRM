import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { enviarNotificacionAUsuarios } from '@/lib/push'

/**
 * POST /api/notifications/test
 *
 * Manda una notificación de prueba SOLO al usuario actual. Útil para
 * verificar que la suscripción del navegador funciona después de activarla.
 */
export const POST = withPermiso('dashboard', 'ver', async (req: NextRequest) => {
  const userIdHeader = req.headers.get('x-user-id')
  const usuarioId = userIdHeader ? parseInt(userIdHeader) : NaN
  if (isNaN(usuarioId)) {
    return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 })
  }

  const result = await enviarNotificacionAUsuarios([usuarioId], {
    title: 'Notificación de prueba ✓',
    body: 'Si ves esto, las notificaciones del CRM están funcionando en este dispositivo.',
    url: '/',
    tag: 'test',
  })

  return NextResponse.json({
    ok: true,
    enviadas: result.enviadas,
    eliminadas: result.eliminadas,
    mensaje: result.enviadas === 0
      ? 'No hay subscripciones activas para tu usuario en este momento.'
      : `Notificación enviada a ${result.enviadas} dispositivo(s).`,
  })
})
