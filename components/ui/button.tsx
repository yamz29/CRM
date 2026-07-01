import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  /**
   * Tono semántico opcional para acciones de color (verde "Aprobar", rojo
   * destructivo) sin hardcodear `bg-green-600`. Si se pasa, sobrescribe el color
   * de la `variant` manteniendo padding/focus/disabled. Para botones neutros usar
   * solo `variant`.
   */
  color?: 'success' | 'danger'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', color, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary:
        'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40',
      secondary:
        'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border dark:bg-white/[0.05] dark:border-white/[0.1] dark:hover:bg-white/[0.1]',
      ghost:
        'bg-transparent text-foreground hover:bg-muted dark:hover:bg-white/[0.06] focus:ring-muted-foreground',
      danger:
        'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/30',
      outline:
        'bg-transparent border border-border dark:border-white/[0.1] text-foreground hover:bg-muted dark:hover:bg-white/[0.06] focus:ring-muted-foreground',
    }

    // Tonos semánticos: sobrescriben el color de la variant cuando se pasa `color`.
    const colors = {
      success:
        'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/30',
      danger:
        'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, color ? colors[color] : variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export { Button }
