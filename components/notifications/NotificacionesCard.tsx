'use client'

import { Bell, BellOff, BellRing, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushNotifications } from './usePushNotifications'

/**
 * Card que el usuario usa para activar/desactivar notificaciones push en
 * el navegador actual. Pensado para ir en /configuracion (tab "Mi cuenta")
 * o donde el admin decida.
 *
 * Nota: cada navegador/dispositivo tiene su propia subscripción. Si el user
 * usa el CRM en su laptop y en su teléfono, tiene que activarlas en cada
 * uno por separado.
 */
export function NotificacionesCard() {
  const { status, error, trabajando, activar, desactivar, probar } = usePushNotifications()

  if (status === 'cargando') {
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Verificando estado…
      </div>
    )
  }

  if (status === 'no-soportado') {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground">Notificaciones no disponibles</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Este navegador no soporta notificaciones push (Service Worker o Push API no disponibles).
              Prueba en Chrome, Edge o Firefox actualizados.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'no-configurado') {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground">Notificaciones no configuradas</h3>
            <p className="text-sm text-muted-foreground mt-1">
              El servidor todavía no tiene VAPID keys generadas. Pídele al administrador que las
              configure en <code className="text-xs bg-muted px-1 rounded">.env.server</code>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        {status === 'suscrito'
          ? <BellRing className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          : status === 'denegado'
            ? <BellOff className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            : <Bell className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            {status === 'suscrito' && 'Notificaciones activas en este dispositivo'}
            {status === 'no-suscrito' && 'Notificaciones del CRM'}
            {status === 'denegado' && 'Permiso denegado'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {status === 'suscrito' && 'Recibirás avisos del sistema (facturas que vencen, cronogramas atrasados, cambios de estado en proyectos) aunque tengas el navegador minimizado.'}
            {status === 'no-suscrito' && 'Activa para recibir avisos del sistema en este navegador. Funciona aunque tengas la pestaña minimizada, no requiere correo.'}
            {status === 'denegado' && 'Bloqueaste las notificaciones desde el navegador. Para activarlas tienes que cambiarlo desde la configuración del navegador (icono del candado en la barra de direcciones → Notificaciones → Permitir) y volver acá.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {status === 'no-suscrito' && (
          <Button onClick={activar} disabled={trabajando}>
            {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Activar notificaciones
          </Button>
        )}
        {status === 'suscrito' && (
          <>
            <Button variant="outline" onClick={probar} disabled={trabajando}>
              {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Enviar prueba
            </Button>
            <Button variant="ghost" onClick={desactivar} disabled={trabajando}>
              <BellOff className="w-4 h-4" /> Desactivar
            </Button>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        <strong>Nota:</strong> cada dispositivo/navegador es independiente. Si usas el CRM en tu
        laptop y tu teléfono, tienes que activar las notificaciones en cada uno por separado.
      </div>
    </div>
  )
}
