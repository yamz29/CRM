import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RecursoForm } from '@/components/recursos/RecursoForm'

export default function NuevoRecursoPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/recursos"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo Recurso</h1>
          <p className="text-slate-500 text-sm mt-0.5">Agregar recurso al catálogo maestro</p>
        </div>
      </div>
      <RecursoForm mode="create" />
    </div>
  )
}
