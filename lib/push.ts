import webpush from 'web-push'
import { prisma } from './prisma'

/**
 * Envío de notificaciones Web Push.
 *
 * Configuración: VAPID keys en .env.server
 *   VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:admin@gonzalva.com  (o cualquier mailto válido)
 *
 * Generar par de keys una sola vez con: `npx web-push generate-vapid-keys`
 */

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  if (!pub || !priv) {
    console.warn('[push] VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no configuradas — notificaciones desactivadas')
    return false
  }
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  /** Ruta dentro de la app a la que el SW navegará al hacer click. */
  url?: string
  /** Tag para que notificaciones del mismo tipo se reemplacen entre sí
   *  (evita spam de "5 cronogramas atrasados" como 5 burbujas separadas). */
  tag?: string
}

/**
 * Envía una notificación a TODAS las subscripciones de un set de usuarios.
 * Limpia automáticamente subscripciones caducadas (410 Gone, 404).
 * No falla si VAPID no está configurado — solo loggea y retorna 0.
 */
export async function enviarNotificacionAUsuarios(
  usuarioIds: number[],
  payload: PushPayload
): Promise<{ enviadas: number; eliminadas: number }> {
  if (!ensureConfigured()) return { enviadas: 0, eliminadas: 0 }
  if (usuarioIds.length === 0) return { enviadas: 0, eliminadas: 0 }

  const subs = await prisma.pushSubscription.findMany({
    where: { usuarioId: { in: usuarioIds } },
  })
  if (subs.length === 0) return { enviadas: 0, eliminadas: 0 }

  const body = JSON.stringify(payload)
  let enviadas = 0
  const subsParaEliminar: number[] = []

  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
      enviadas++
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode
      // 410 Gone | 404 Not Found = subscription caducada
      if (status === 410 || status === 404) {
        subsParaEliminar.push(sub.id)
      } else {
        console.error(`[push] error enviando a sub ${sub.id} (status=${status}):`, e)
      }
    }
  }))

  if (subsParaEliminar.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: subsParaEliminar } },
    })
  }

  return { enviadas, eliminadas: subsParaEliminar.length }
}

/**
 * Envía a todos los usuarios marcados como "interesados" en notificaciones
 * del sistema. Es la API más usada por los triggers.
 */
export async function enviarNotificacionAInteresados(
  payload: PushPayload
): Promise<{ enviadas: number; eliminadas: number }> {
  const interesados = await prisma.usuario.findMany({
    where: { esInteresadoNotificaciones: true, activo: true },
    select: { id: true },
  })
  return enviarNotificacionAUsuarios(interesados.map(u => u.id), payload)
}
