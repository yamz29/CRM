import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  href?: string
}

/**
 * Migas de pan para orientar al usuario en páginas profundas.
 * El último item se muestra como página actual (sin enlace).
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Ruta de navegación" className={cn('flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap', className)}>
      <Link href="/" className="flex items-center hover:text-foreground transition-colors" aria-label="Inicio">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-foreground transition-colors truncate max-w-[200px]">
                {item.label}
              </Link>
            ) : (
              <span
                className={cn('truncate max-w-[260px]', last && 'text-foreground font-medium')}
                aria-current={last ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
