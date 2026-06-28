import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
        <FileQuestion className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-5xl font-black text-foreground tracking-tight">404</p>
      <h1 className="text-xl font-bold text-foreground mt-3">Página no encontrada</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-sm">
        La página que buscas no existe o fue movida. Verifica la dirección o vuelve al inicio.
      </p>
      <Link href="/" className="mt-6">
        <Button>
          <Home className="w-4 h-4" /> Volver al inicio
        </Button>
      </Link>
    </div>
  )
}
