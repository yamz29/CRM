'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook que encapsula el ciclo de vida de las notificaciones Web Push:
 * permiso del navegador, registro del Service Worker, suscripción al
 * push manager, y registro/desregistro en el backend.
 *
 * Estados expuestos:
 * - status: el navegador soporta push? hay permiso? hay subscription activa?
 * - activar(): pide permiso y se suscribe.
 * - desactivar(): elimina la subscription local + del backend.
 * - probar(): pide al backend que mande una notificación de prueba.
 */

type Status =
  | 'cargando'              // verificando estado inicial
  | 'no-soportado'          // el navegador no tiene Push API o Service Worker
  | 'denegado'              // user denegó permiso
  | 'no-suscrito'           // soportado pero no activado todavía
  | 'suscrito'              // todo OK
  | 'no-configurado'        // VAPID no está en el server

export function usePushNotifications() {
  const [status, setStatus] = useState<Status>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  // Verifica el estado inicial al montar
  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('no-soportado')
      return
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) {
        // El SW se registra cuando el user activa, no automáticamente
        if (Notification.permission === 'denied') setStatus('denegado')
        else setStatus('no-suscrito')
        return
      }
      const sub = await reg.pushManager.getSubscription()
      if (sub) setStatus('suscrito')
      else if (Notification.permission === 'denied') setStatus('denegado')
      else setStatus('no-suscrito')
    } catch (e) {
      console.error('[push] refresh:', e)
      setStatus('no-suscrito')
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const activar = useCallback(async () => {
    setError(null); setTrabajando(true)
    try {
      // 1. Pedir VAPID public key del backend
      const keyRes = await fetch('/api/notifications/vapid-public-key', { cache: 'no-store' })
      const keyData = await keyRes.json()
      if (!keyRes.ok || !keyData.configured) {
        setStatus('no-configurado')
        setError('Las notificaciones aún no están configuradas en el servidor. Pídele al admin que genere las VAPID keys.')
        return
      }
      const vapidKey = keyData.key as string

      // 2. Pedir permiso al navegador
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denegado')
        setError('Permiso denegado. Cámbialo desde la configuración del navegador si quieres activarlas.')
        return
      }

      // 3. Registrar el Service Worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // 4. Crear subscription en el push manager
      // Cast a BufferSource: TS 5.x estricto con Uint8Array<ArrayBufferLike>
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      // 5. Mandar al backend
      const subRes = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
            auth: arrayBufferToBase64(sub.getKey('auth')!),
          },
          userAgent: navigator.userAgent,
        }),
      })
      if (!subRes.ok) {
        setError('No se pudo registrar la suscripción en el servidor.')
        return
      }
      setStatus('suscrito')
    } catch (e) {
      console.error('[push] activar:', e)
      setError(e instanceof Error ? e.message : 'Error activando notificaciones')
    } finally {
      setTrabajando(false)
    }
  }, [])

  const desactivar = useCallback(async () => {
    setError(null); setTrabajando(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('no-suscrito')
    } catch (e) {
      console.error('[push] desactivar:', e)
      setError(e instanceof Error ? e.message : 'Error desactivando')
    } finally {
      setTrabajando(false)
    }
  }, [])

  const probar = useCallback(async () => {
    setError(null); setTrabajando(true)
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'No se pudo probar')
      else if (data.enviadas === 0) setError(data.mensaje || 'Sin subs activas')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error probando')
    } finally {
      setTrabajando(false)
    }
  }, [])

  return { status, error, trabajando, activar, desactivar, probar, refresh }
}

// ── Helpers ──────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
