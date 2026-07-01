'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useToast } from '@/components/ui/toast'

/**
 * Feedback de éxito tras un redirect server-side con `?msg=` (#H43).
 *
 * Antes renderizaba un banner verde propio; ahora dispara un **toast** al montar
 * y limpia el `?msg` de la URL, para unificar todo el feedback positivo en un
 * solo sistema (useToast, cuyo provider vive en el layout raíz). El nombre se
 * conserva para no tocar los ~10 server components que lo usan como
 * `{msg === 'creado' && <SuccessBanner mensaje="..." />}`.
 */
interface SuccessBannerProps {
  mensaje: string
}

export function SuccessBanner({ mensaje }: SuccessBannerProps) {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const disparado = useRef(false)

  useEffect(() => {
    if (disparado.current) return
    disparado.current = true
    toast.exito(mensaje)
    // Quitar solo `msg` de la URL para no repetir el toast al refrescar/volver,
    // preservando el resto de los query params.
    const params = new URLSearchParams(window.location.search)
    params.delete('msg')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
