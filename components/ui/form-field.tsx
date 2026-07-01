import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Envoltura de campo de formulario (#H17): label + requerido + error inline.
 * Patrón compartido para dar validación consistente por campo en todos los
 * formularios del repo.
 */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label?: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-1">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

/** className base para inputs con estado de error (borde rojo cuando `error`). */
export function inputClass(error?: string) {
  return cn(
    'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
    error ? 'border-red-400 focus:ring-red-400' : 'border-border',
  )
}
