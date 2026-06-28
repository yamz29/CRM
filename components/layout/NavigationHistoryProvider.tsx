'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Indica si existe historial de navegación in-app al que volver.
 *
 * Por defecto `false`: cualquier componente que use el contexto fuera del
 * provider (p. ej. vistas de login/impresión que se montan sin el shell)
 * caerá de forma segura al fallback en vez de intentar un `router.back()`.
 */
const NavigationHistoryContext = createContext<boolean>(false)

export function useCanGoBack(): boolean {
  return useContext(NavigationHistoryContext)
}

/**
 * Rastrea si el usuario ha realizado al menos una navegación SPA en esta
 * pestaña desde que se cargó el documento.
 *
 * El provider vive en el árbol persistente del layout, por lo que NO se
 * remonta entre navegaciones cliente: solo cambia su `pathname`. En la carga
 * inicial (o tras un F5 / enlace directo) el provider se monta de cero, de modo
 * que la primera ejecución del efecto no cuenta como "pantalla previa" y
 * `canGoBack` queda en `false`. A partir de la primera navegación interna pasa
 * a `true`, habilitando `router.back()` con restauración de URL y scroll.
 */
export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [canGoBack, setCanGoBack] = useState(false)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    if (isInitialLoad.current) {
      // Carga inicial del documento: no hay pantalla in-app anterior.
      isInitialLoad.current = false
      return
    }
    // Cambio de ruta por navegación cliente → ya hay historial al que volver.
    setCanGoBack(true)
  }, [pathname])

  return (
    <NavigationHistoryContext.Provider value={canGoBack}>
      {children}
    </NavigationHistoryContext.Provider>
  )
}
