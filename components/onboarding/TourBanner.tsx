'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, ArrowRight } from 'lucide-react'

const LS_KEY = 'crm-tour-banner-oculto'

/**
 * Banner flotante que invita al usuario a hacer el tour de primeros pasos.
 *
 * Solo se muestra si:
 *  - El usuario nunca lo cerró antes (localStorage).
 *  - El sistema todavía tiene al menos un item del checklist sin cumplir
 *    (se chequea contra /api/onboarding/progreso).
 *
 * Si está todo el sistema "puesto en marcha" (>=N pasos completados),
 * el banner desaparece automáticamente.
 */
export function TourBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Si el usuario ya cerró el banner manualmente, no mostrar más
    if (typeof window !== 'undefined' && localStorage.getItem(LS_KEY) === '1') return

    // Verificar contra el backend si todavía hay pasos pendientes
    fetch('/api/onboarding/progreso', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((data: { checklist: Record<string, boolean> } | null) => {
        if (!data) return
        const items = Object.values(data.checklist)
        const completados = items.filter(Boolean).length
        // Si más de la mitad ya está hecho, asumimos que el sistema está en marcha
        // y ya no hace falta el banner.
        if (completados < items.length / 2) {
          setVisible(true)
        }
      })
      .catch(() => { /* silencio */ })
  }, [])

  function cerrar() {
    localStorage.setItem(LS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="relative bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">
            👋 ¿Es tu primera vez con el sistema?
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Te armé una guía rápida por rol (vendedor, supervisor, contable). Te lleva paso a paso por los flujos típicos.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/ayuda/primeros-pasos"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Empezar tour
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={cerrar}
          aria-label="Cerrar"
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
