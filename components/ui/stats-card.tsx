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
      'bg-card rounded-xl border border-border p-5 transition-all duration-300',
      'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5',
      'dark:bg-card/80 dark:backdrop-blur-xl dark:border-white/[0.06]',
      'dark:hover:border-primary/30 dark:hover:shadow-primary/10',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl', colorClass)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
