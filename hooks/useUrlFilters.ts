'use client'

import { useCallback, useEffect, useState } from 'react'
import { rememberListUrl } from '@/lib/module-memory'

/**
 * Sincroniza un conjunto de filtros de lista con el query string de la URL,
 * para que el botón "Atrás" (y la memoria de módulo) restauren la vista del
 * usuario: filtros, orden, búsqueda.
 *
 * Detalles de diseño:
 * - Los valores son cadenas (los booleanos se representan como '1' / '').
 *   Pasa un objeto `defaults` con TODAS las claves; las que igualan su default
 *   se omiten de la URL para mantenerla limpia.
 * - La escritura usa `window.history.replaceState`, NO `router.push`: así los
 *   cambios de filtro no contaminan el historial (Atrás no deshace filtro a
 *   filtro) ni provocan un refetch del server component padre. El filtrado de
 *   estas listas ocurre en memoria sobre los datos ya cargados.
 * - La lectura inicial desde la URL se hace en un efecto de montaje (evita
 *   `useSearchParams`, que exigiría un <Suspense> y desactiva el prerender).
 *   Al volver a la lista, el componente se remonta y reaplica los filtros.
 *
 * @returns `[values, setFilters]` — `setFilters` acepta un parcial.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T,
): readonly [T, (updates: Partial<T>) => void] {
  const [values, setValues] = useState<T>(defaults)

  // Hidratar desde la URL al montar (solo cliente).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const next = { ...defaults }
    let changed = false
    for (const key of Object.keys(defaults)) {
      const v = sp.get(key)
      if (v !== null) {
        next[key as keyof T] = v as T[keyof T]
        changed = true
      }
    }
    if (changed) setValues(next)
    // Solo en el montaje: los `defaults` son estables por lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setFilters = useCallback(
    (updates: Partial<T>) => {
      setValues((prev) => {
        const next = { ...prev, ...updates }
        const params = new URLSearchParams()
        for (const key of Object.keys(next)) {
          const val = next[key as keyof T]
          if (val && val !== defaults[key as keyof T]) params.set(key, String(val))
        }
        const qs = params.toString()
        const { pathname } = window.location
        const url = qs ? `${pathname}?${qs}` : pathname
        window.history.replaceState(null, '', url)
        rememberListUrl(pathname, qs ? `?${qs}` : '')
        return next
      })
    },
    // `defaults` estable por lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return [values, setFilters] as const
}
