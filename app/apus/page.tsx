import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Plus } from 'lucide-react'
import { SuccessBanner } from '@/components/ui/success-banner'
import { ApusTable } from '@/components/apus/ApusTable'
import { HelpDrawer } from '@/components/help/HelpDrawer'

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
      <PageHeader
        title="Catálogo de APUs"
        subtitle={`${apus.length} análisis de precios unitarios`}
        actions={
          <>
            <HelpDrawer slug="apu" titulo="APU" />
            <Link href="/apus/nuevo">
              <Button><Plus className="w-4 h-4" /> Nuevo APU</Button>
            </Link>
          </>
        }
      />

      <ApusTable apus={apus} />
    </div>
  )
}
