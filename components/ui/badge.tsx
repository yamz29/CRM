import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'orange'
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
      success:
        'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      warning:
        'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
      danger:
        'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      info:
        'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      secondary:
        'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-600',
      orange:
        'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'

export function EstadoProyectoBadge({ estado }: { estado: string }) {
  const variantMap: Record<string, BadgeProps['variant']> = {
    'Prospecto': 'default',
    'En Cotización': 'info',
    'Adjudicado': 'warning',
    'En Ejecución': 'success',
    'Pausado': 'orange',
    'Terminado': 'secondary',
    'Cancelado': 'danger',
  }
  return <Badge variant={variantMap[estado] || 'default'}>{estado}</Badge>
}

export function EstadoPresupuestoBadge({ estado }: { estado: string }) {
  const variantMap: Record<string, BadgeProps['variant']> = {
    'Borrador': 'default',
    'Enviado': 'info',
    'Aprobado': 'success',
    'Rechazado': 'danger',
  }
  return <Badge variant={variantMap[estado] || 'default'}>{estado}</Badge>
}

export { Badge }
