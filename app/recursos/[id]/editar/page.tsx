import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { RecursoForm } from '@/components/recursos/RecursoForm'
import { PriceHistoryPanel } from '@/components/recursos/PriceHistoryPanel'

export default async function EditarRecursoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const recurso = await prisma.recurso.findUnique({ where: { id } })
  if (!recurso) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/recursos"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Recurso</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{recurso.nombre}</p>
        </div>
      </div>
      <RecursoForm mode="edit" initialData={{
        ...recurso,
        codigo: recurso.codigo ?? undefined,
        categoria: recurso.categoria ?? undefined,
        subcategoria: recurso.subcategoria ?? undefined,
        proveedor: recurso.proveedor ?? undefined,
        marca: recurso.marca ?? undefined,
        observaciones: recurso.observaciones ?? undefined,
      }} />
      <PriceHistoryPanel recursoId={id} />
    </div>
  )
}
