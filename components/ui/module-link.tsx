'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getRememberedUrl, isModuleRoot } from '@/lib/module-memory'

/**
 * Resuelve el href de un enlace a un módulo: si es la raíz de un módulo y hay
 * una vista recordada (con filtros), devuelve esa URL; si no, el href original.
 *
 * Se resuelve tras el montaje (sessionStorage es solo de cliente) y se re-evalúa
 * al cambiar de ruta, de modo que el enlace refleja la última lista filtrada que
 * visitó el usuario. El estado activo del enlace se sigue calculando contra el
 * href base, así que no se ve afectado.
 */
export function useResolvedModuleHref(href: string): string {
  const pathname = usePathname()
  const [resolved, setResolved] = useState(href)

  useEffect(() => {
    if (!href.startsWith('/') || !isModuleRoot(href)) {
      setResolved(href)
      return
    }
    setResolved(getRememberedUrl(href) ?? href)
  }, [href, pathname])

  return resolved
}

/**
 * Enlace de breadcrumb hacia un módulo, con memoria de módulo. Reemplaza al
 * <Link> de los items intermedios para que regresen a la última vista filtrada.
 */
export function CrumbLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  const resolved = useResolvedModuleHref(href)
  return (
    <Link href={resolved} className={cn(className)}>
      {children}
    </Link>
  )
}
