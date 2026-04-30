/**
 * Hook de instrumentación de Next.js. Se ejecuta una vez al arrancar
 * el servidor (tanto en dev como en prod). Usado para inicializar el
 * scheduler de notificaciones.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Solo en runtime de Node (no en Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Evita iniciar el scheduler durante `next build` (cuando no hay servidor real)
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    const { iniciarSchedulerNotificaciones } = await import('./lib/notificaciones-cron')
    iniciarSchedulerNotificaciones()
  } catch (e) {
    console.error('[instrumentation] error iniciando scheduler de notificaciones:', e)
  }
}
