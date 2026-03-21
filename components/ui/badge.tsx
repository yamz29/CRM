import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary'
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-slate-100 text-slate-700 border-slate-200',
      success: 'bg-green-100 text-green-700 border-green-200',
      warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      danger: 'bg-red-100 text-red-700 border-red-200',
      info: 'bg-blue-100 text-blue-700 border-blue-200',
      secondary: 'bg-slate-200 text-slate-600 border-slate-300',
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
