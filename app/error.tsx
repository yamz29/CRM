'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-xl font-bold text-foreground">Algo salió mal</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-sm">
        Ocurrió un error inesperado al cargar esta sección. Puedes reintentar o volver al inicio.
      </p>
      {error?.digest && (
        <p className="text-2xs text-muted-foreground/60 mt-2 font-mono">Ref: {error.digest}</p>
      )}
      <div className="flex items-center gap-2 mt-6">
        <Button onClick={reset}>
          <RotateCcw className="w-4 h-4" /> Reintentar
        </Button>
        <Link href="/">
          <Button variant="secondary">
            <Home className="w-4 h-4" /> Inicio
          </Button>
        </Link>
      </div>
    </div>
  )
}
