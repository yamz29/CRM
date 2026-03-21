import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SuccessBanner } from '@/components/ui/success-banner'
import { RecursosTable } from '@/components/recursos/RecursosTable'

interface SearchParams { msg?: string }

export default async function RecursosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams

  const recursos = await prisma.recurso.findMany({
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  })

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Recurso creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Recurso actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de Recursos</h1>
          <p className="text-slate-500 mt-1">{recursos.length} recursos · base de datos maestra de costos</p>
        </div>
        <Link href="/recursos/nuevo">
          <Button><Plus className="w-4 h-4" /> Nuevo Recurso</Button>
        </Link>
      </div>

      <RecursosTable recursos={recursos} />
    </div>
  )
}
