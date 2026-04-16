'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'

export function BuscadorModulos() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const qInicial = searchParams.get('q') ?? ''
  const [q, setQ] = useState(qInicial)

  // Sync estado local si cambia el param desde afuera (ej: navegación)
  useEffect(() => { setQ(qInicial) }, [qInicial])

  // Debounce: espera 350ms antes de actualizar la URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (q === qInicial) return
      const params = new URLSearchParams(searchParams.toString())
      if (q.trim()) {
        params.set('q', q.trim())
      } else {
        params.delete('q')
      }
      router.replace(`${pathname}?${params.toString()}`)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function clear() {
    setQ('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Buscar por nombre, código, color…"
        className="w-full h-8 pl-8 pr-8 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {q && (
        <button
          onClick={clear}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          title="Limpiar"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
