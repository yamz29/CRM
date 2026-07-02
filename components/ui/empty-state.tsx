import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from './button'
import { cn } from '@/lib/utils'

/**
 * Estado vacío estándar (auditoría F4): icono + título + descripción + CTA
 * opcional. Reemplaza los "No hay X" ad-hoc dispersos por los listados y
 * convierte el vacío en onboarding ("No hay gastos → Registrar el primero").
 *
 * `accion.href` para navegación; `accion.onClick` para abrir modales (solo
 * desde client components). `compacto` para vacíos dentro de cards.
 */
interface EmptyStateProps {
  icon?: LucideIcon
  titulo: string
  descripcion?: string
  accion?: { label: string; href?: string; onClick?: () => void; icono?: LucideIcon }
  compacto?: boolean
  className?: string
}

export function EmptyState({ icon: Icon, titulo, descripcion, accion, compacto, className }: EmptyStateProps) {
  const AccionIcono = accion?.icono
  const boton = accion ? (
    <Button className="mt-3" onClick={accion.onClick}>
      {AccionIcono && <AccionIcono className="w-4 h-4" />}
      {accion.label}
    </Button>
  ) : null

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center text-muted-foreground',
        compacto ? 'py-8' : 'py-16',
        className,
      )}
    >
      {Icon && <Icon className={cn('text-muted-foreground/40 mb-3', compacto ? 'w-8 h-8' : 'w-12 h-12')} />}
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {descripcion && <p className="text-sm mt-1 max-w-sm">{descripcion}</p>}
      {accion && (accion.href ? <Link href={accion.href}>{boton}</Link> : boton)}
    </div>
  )
}
