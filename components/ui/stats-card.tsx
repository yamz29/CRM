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
      'rounded-xl p-5 transition-all duration-300',
      // Light mode
      'bg-card border border-border shadow-sm',
      'hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5',
      // Dark mode — glass effect
      'dark:bg-white/[0.03] dark:border-white/[0.08] dark:backdrop-blur-sm',
      'dark:hover:bg-white/[0.06] dark:hover:border-blue-500/30 dark:hover:shadow-xl dark:hover:shadow-blue-500/10',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
          {description && (
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{description}</p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl', colorClass)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
