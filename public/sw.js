// Service Worker para notificaciones Web Push del CRM Gonzalva.
// Se registra desde components/notifications/usePushNotifications.ts
// y queda escuchando eventos `push` del proveedor (FCM/Mozilla).

self.addEventListener('install', (event) => {
  // Activar inmediatamente la nueva versión sin esperar a que se cierren las pestañas
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'CRM Gonzalva', body: 'Tienes una notificación nueva.', url: '/', tag: undefined }

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() }
    } catch {
      // Si el payload no es JSON, usamos texto plano como body
      try { payload.body = event.data.text() } catch {}
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag, // Notificaciones con el mismo tag se reemplazan en pantalla
      data: { url: payload.url || '/' },
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // Si ya hay una pestaña del CRM abierta, la enfocamos y navegamos
      for (const c of clientsArr) {
        if ('focus' in c) {
          c.focus()
          if ('navigate' in c && targetUrl) c.navigate(targetUrl)
          return
        }
      }
      // Si no, abrimos una pestaña nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
