'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useCallback, useState, useTransition } from 'react'

interface Props {
  q?: string
  estado?: string
}

export function PresupuestosBuscador({ q: initialQ, estado }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(initialQ ?? '')
  const [, startTransition] = useTransition()

  const push = useCallback(
    (value: string) => {
      const params = new URLSearchParams()
      if (value) params.set('q', value)
      if (estado) params.set('estado', estado)
      const s = params.toString()
      startTransition(() => {
        router.push(`${pathname}${s ? `?${s}` : ''}`)
      })
    },
    [router, pathname, estado]
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQ(val)
    // Debounce simple: solo navegar al escribir pause de 400ms
    clearTimeout((window as any)._presSearchTimer)
    ;(window as any)._presSearchTimer = setTimeout(() => push(val), 400)
  }

  function handleClear() {
    setQ('')
    push('')
  }

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={q}
        onChange={handleChange}
        placeholder="Buscar por número, cliente o proyecto..."
        className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {q && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
