import { prisma } from '@/lib/prisma'
import { ProyectoForm } from '@/components/proyectos/ProyectoForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NuevoProyectoPage({
  searchParams,
}: {
  searchParams: { clienteId?: string }
}) {
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/proyectos"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo Proyecto</h1>
          <p className="text-slate-500 mt-0.5">Registra un nuevo proyecto en el sistema</p>
        </div>
      </div>

      <ProyectoForm
        clientes={clientes}
        mode="create"
        defaultClienteId={searchParams.clienteId}
      />
    </div>
  )
}
