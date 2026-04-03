'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const PERIODOS = [
  { value: 'hoy',    label: 'Hoy' },
  { value: 'semana', label: '7 días' },
  { value: 'mes',    label: '30 días' },
  { value: 'ano',    label: '12 meses' },
  { value: 'todo',   label: 'Todo' },
]

export function PeriodoSelector() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const current      = searchParams.get('periodo') ?? 'mes'

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periodo', value)
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-muted dark:bg-white/[0.04] dark:border dark:border-white/[0.08] rounded-lg p-1">
      {PERIODOS.map(p => (
        <button
          key={p.value}
          onClick={() => select(p.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            current === p.value
              ? 'bg-card dark:bg-white/[0.1] text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
