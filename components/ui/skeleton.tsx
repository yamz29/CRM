import { cn } from '@/lib/utils'

/** Bloque de carga con shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/**
 * Esqueleto genérico para páginas de detalle (breadcrumbs + cabecera +
 * stat cards + tabs + contenido). Se usa desde los loading.tsx de las
 * rutas [id] (auditoría F4: antes navegar a un detalle no daba feedback).
 */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton className="h-4 w-64" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

/**
 * Esqueleto genérico para páginas de lista (cabecera + filtros + tabla).
 * Se usa desde los loading.tsx de cada ruta.
 */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Barra de filtros */}
      <Skeleton className="h-14 w-full rounded-xl" />

      {/* Tabla */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
