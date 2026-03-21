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
  colorClass = 'bg-blue-50 text-blue-600',
  className,
}: StatsCardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', colorClass)}>
          {icon}
        </div>
      </div>
    </div>
  )
}
