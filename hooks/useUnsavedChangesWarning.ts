'use client'

import { useEffect } from 'react'

/**
 * Avisa al usuario antes de salir de la página con cambios sin guardar.
 *
 * Cubre 3 escenarios:
 *   1. Cerrar pestaña / recargar (F5, Cmd+R, ⌘W) → `beforeunload` nativo.
 *   2. Click en cualquier `<a href="...">` interno o externo → confirm().
 *   3. Botón "atrás" del navegador → `popstate` con re-push del estado.
 *
 * Limitaciones conocidas:
 *   - Si llamas `router.push()` programáticamente desde otro componente, NO
 *     se intercepta. Pero los casos típicos del usuario (click en sidebar,
 *     atrás del navegador, cerrar pestaña) sí están cubiertos.
 *   - Cmd+K (búsqueda global) navega vía router.push y no se intercepta,
 *     pero el modal se cierra y el form sigue en pantalla — comportamiento
 *     aceptable porque no perdiste estado.
 *
 * @param dirty - true cuando hay cambios sin guardar
 * @param mensaje - texto del confirm en navegación interna (los navegadores
 *   modernos ignoran el mensaje custom del beforeunload, muestran el suyo)
 */
export function useUnsavedChangesWarning(
  dirty: boolean,
  mensaje = 'Tienes cambios sin guardar. ¿Salir de todas formas?'
) {
  useEffect(() => {
    if (!dirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Algunos navegadores aún leen returnValue (legacy)
      e.returnValue = ''
    }

    const handleAnchorClick = (e: MouseEvent) => {
      // Solo clicks izquierdos sin modificadores (cmd/ctrl/shift/alt = abrir en pestaña nueva, no navegan acá)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return // anclas internas no navegan
      if (anchor.target === '_blank') return // se abre en pestaña nueva, no perdés state

      if (!confirm(mensaje)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handlePopState = () => {
      if (!confirm(mensaje)) {
        // Re-pushear el estado actual para "deshacer" el back/forward
        history.pushState(null, '', window.location.href)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleAnchorClick, true) // capture phase para interceptar antes que Next
    window.addEventListener('popstate', handlePopState)
    // Push un estado dummy para que popstate intercepte el primer "atrás"
    history.pushState(null, '', window.location.href)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleAnchorClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [dirty, mensaje])
}
