import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Plus } from 'lucide-react'
import { SuccessBanner } from '@/components/ui/success-banner'
import { ExportButton } from '@/components/ui/export-button'
import { ClientesPageClient } from '@/components/clientes/ClientesPageClient'

interface SearchParams {
  msg?: string
}

async function getClientes() {
  return prisma.cliente.findMany({
    include: {
      _count: {
        select: { proyectos: true, presupuestos: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { msg } = await searchParams
  const clientes = await getClientes()

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Cliente creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Cliente actualizado exitosamente" />}
      {/* Header */}
      <PageHeader
        title="Clientes"
        subtitle={`${clientes.length} clientes registrados`}
        actions={
          <>
            <ExportButton href="/api/export/clientes" label="Exportar" />
            <Link href="/clientes/nuevo">
              <Button>
                <Plus className="w-4 h-4" />
                Nuevo Cliente
              </Button>
            </Link>
          </>
        }
      />

      <ClientesPageClient clientes={clientes} />
    </div>
  )
}
