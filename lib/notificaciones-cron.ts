import { prisma } from './prisma'
import { enviarNotificacionAInteresados } from './push'

/**
 * Job diario de notificaciones del sistema.
 *
 * Detecta:
 *   1. Facturas que vencen en los próximos 3 días (o vencidas hoy mismo).
 *   2. Cronogramas con actividades atrasadas (fechaFin < hoy y avance < 100).
 *
 * Diseñado para correr una vez al día. La idempotencia por día se logra
 * usando `tag` en la notificación: si el SW ya mostró una con el mismo
 * tag, la reemplaza. No duplica burbujas en pantalla aunque corra dos
 * veces el mismo día.
 *
 * Ejecución:
 *   - Llamado desde un setInterval/setTimeout en lib/notificaciones-scheduler.ts
 *     que arranca con el server.
 *   - O manualmente desde un endpoint admin (POST /api/notifications/run-cron).
 */
export async function correrNotificacionesDiarias(): Promise<{
  facturasVencen: number
  cronogramasAtrasados: number
}> {
  const hoy = new Date()
  const en3Dias = new Date(hoy.getTime() + 3 * 86_400_000)

  // ── 1. Facturas que vencen ────────────────────────────────────────
  const facturasVenciendo = await prisma.factura.count({
    where: {
      tipo: 'ingreso',
      estado: { in: ['pendiente', 'parcial'] },
      esProforma: false,
      fechaVencimiento: { gte: hoy, lte: en3Dias },
    },
  })

  if (facturasVenciendo > 0) {
    await enviarNotificacionAInteresados({
      title: 'Facturas próximas a vencer',
      body: `${facturasVenciendo} factura${facturasVenciendo > 1 ? 's' : ''} de cobro vence${facturasVenciendo > 1 ? 'n' : ''} en los próximos 3 días.`,
      url: '/facturacion?filtroEstado=pendiente',
      tag: 'facturas-venciendo',
    })
  }

  const facturasVencidas = await prisma.factura.count({
    where: {
      tipo: 'ingreso',
      estado: { in: ['pendiente', 'parcial'] },
      esProforma: false,
      fechaVencimiento: { lt: hoy },
    },
  })

  if (facturasVencidas > 0) {
    await enviarNotificacionAInteresados({
      title: 'Facturas vencidas sin cobrar',
      body: `${facturasVencidas} factura${facturasVencidas > 1 ? 's' : ''} venció${facturasVencidas > 1 ? 'eron' : ''} sin cobrar. Hay que dar seguimiento al cliente.`,
      url: '/facturacion?filtroEstado=pendiente',
      tag: 'facturas-vencidas',
    })
  }

  // ── 2. Cronogramas atrasados ──────────────────────────────────────
  const actividadesAtrasadas = await prisma.actividadCronograma.count({
    where: {
      pctAvance: { lt: 100 },
      fechaFin: { lt: hoy },
      // Solo proyectos no cerrados
      cronograma: { proyecto: { estado: { not: 'Cerrado' } } },
    },
  })

  if (actividadesAtrasadas > 0) {
    await enviarNotificacionAInteresados({
      title: 'Cronogramas con actividades atrasadas',
      body: `${actividadesAtrasadas} actividad${actividadesAtrasadas > 1 ? 'es' : ''} de cronograma debían terminar pero siguen sin completarse.`,
      url: '/cronograma',
      tag: 'cronogramas-atrasados',
    })
  }

  return { facturasVencen: facturasVenciendo + facturasVencidas, cronogramasAtrasados: actividadesAtrasadas }
}

/**
 * Scheduler que corre el job una vez al día a las 8 AM hora dominicana.
 * Se invoca desde el bootstrap del server. Usa `setTimeout` recursivo
 * (no `node-cron`) para no agregar dependencia.
 *
 * NOTA: en cluster mode de PM2 con N workers, esto correría N veces el
 * mismo día. Aceptable porque el `tag` del SW deduplica visualmente.
 * Si crece el volumen, mover a cron del sistema (systemd timer).
 */
let timer: ReturnType<typeof setTimeout> | null = null

function msHasta8AmDominicana(): number {
  // Santo Domingo es UTC-4 todo el año (no aplica DST).
  const ahora = Date.now()
  const ahoraDoM = new Date(ahora - 4 * 3600 * 1000) // hora DO en UTC sumas
  const target = new Date(Date.UTC(
    ahoraDoM.getUTCFullYear(),
    ahoraDoM.getUTCMonth(),
    ahoraDoM.getUTCDate(),
    8 + 4, // 8 AM DO = 12:00 UTC
    0, 0, 0
  ))
  let diff = target.getTime() - ahora
  if (diff <= 0) diff += 24 * 3600 * 1000 // si ya pasó, mañana
  return diff
}

export function iniciarSchedulerNotificaciones() {
  if (timer) return // ya iniciado

  const tick = async () => {
    try {
      const result = await correrNotificacionesDiarias()
      console.log('[notif-cron]', result)
    } catch (e) {
      console.error('[notif-cron] error:', e)
    } finally {
      // Re-agendar para mañana a la misma hora
      timer = setTimeout(tick, msHasta8AmDominicana())
    }
  }

  timer = setTimeout(tick, msHasta8AmDominicana())
  console.log(`[notif-cron] scheduler iniciado, próximo tick en ${Math.round(msHasta8AmDominicana() / 60_000)} min`)
}
