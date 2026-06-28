'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useCanGoBack } from '@/components/layout/NavigationHistoryProvider'
import { cn } from '@/lib/utils'

/**
 * Devuelve una función de "Atrás" inteligente: si hay historial de navegación
 * in-app vuelve a la pantalla previa (`router.back()`, restaurando URL y
 * scroll); en caso contrario navega al `fallbackHref` del módulo. Nunca fuerza
 * el Dashboard salvo que ese sea el fallback indicado.
 *
 * Útil para botones "Cancelar"/"Volver" dentro de otros componentes (forms,
 * cabeceras a medida) que no usan directamente <BackButton>.
 */
export function useSmartBack(fallbackHref: string) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return useCallback(() => {
    if (canGoBack) router.back()
    else router.push(fallbackHref)
  }, [canGoBack, fallbackHref, router])
}

interface BackButtonProps {
  /** Ruta del módulo a la que volver cuando no existe historial in-app. */
  fallbackHref: string
  /** `icon`: botón cuadrado con flecha (por defecto). `text`: enlace con etiqueta. */
  variant?: 'icon' | 'text'
  /** Etiqueta para la variante `text` (p. ej. "Volver a Ayuda"). */
  label?: string
  className?: string
  'aria-label'?: string
}

/**
 * Botón "Atrás" reutilizable para todo el ERP. Respeta el historial de
 * navegación del usuario y cae a `fallbackHref` cuando no lo hay.
 *
 * Es un client component, por lo que puede usarse dentro de server components.
 */
export function BackButton({
  fallbackHref,
  variant = 'icon',
  label,
  className,
  'aria-label': ariaLabel,
}: BackButtonProps) {
  const goBack = useSmartBack(fallbackHref)

  if (variant === 'text') {
    return (
      <button
        type="button"
        onClick={goBack}
        aria-label={ariaLabel ?? label ?? 'Volver'}
        className={cn(
          'inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors',
          className,
        )}
      >
        <ArrowLeft className="w-4 h-4" />
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel ?? 'Volver'}
      className={cn(
        'flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors',
        className,
      )}
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  )
}
