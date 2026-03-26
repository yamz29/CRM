import * as React from 'react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  colorClass?: string
  className?: string
}

export function StatsCard({
  title,
  value,
  icon,
  description,
  colorClass = 'bg-blue-500/10 text-blue-500',
  className,
}: StatsCardProps) {
  return (
    <div className={cn(
      'bg-card text-card-foreground rounded-xl border border-border p-6 shadow-sm hover:shadow-md hover:border-border/80 transition-all duration-200',
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', colorClass)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
