import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SuccessBanner } from '@/components/ui/success-banner'
import { ApusTable } from '@/components/apus/ApusTable'

interface SearchParams { msg?: string }

export default async function ApusPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams

  const apus = await prisma.apuCatalogo.findMany({
    include: { _count: { select: { recursos: true } } },
    orderBy: [{ capitulo: 'asc' }, { nombre: 'asc' }],
  })

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="APU creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="APU actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de APUs</h1>
          <p className="text-slate-500 mt-1">{apus.length} análisis de precios unitarios</p>
        </div>
        <Link href="/apus/nuevo">
          <Button><Plus className="w-4 h-4" /> Nuevo APU</Button>
        </Link>
      </div>

      <ApusTable apus={apus} />
    </div>
  )
}
