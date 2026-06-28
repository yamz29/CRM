'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { rememberListUrl } from '@/lib/module-memory'

/**
 * Registra la URL de las listas raíz de módulo (con sus filtros) en la memoria
 * de módulo. Cubre las listas que filtran vía query params del lado servidor
 * (Clientes, Proyectos, Presupuestos) y el aterrizaje inicial en cualquier
 * lista. Las listas que filtran en memoria con `useUrlFilters` además registran
 * la URL en cada cambio de filtro.
 *
 * Usa `useSearchParams`, por lo que debe montarse dentro de un <Suspense> para
 * no desactivar el prerender de las rutas.
 */
export function ModuleMemoryTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams.toString()
    rememberListUrl(pathname, qs ? `?${qs}` : '')
  }, [pathname, searchParams])

  return null
}
