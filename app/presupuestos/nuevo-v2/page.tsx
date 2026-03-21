import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PresupuestoV2Builder } from '@/components/presupuestos/PresupuestoV2Builder'

export default async function NuevoPresupuestoV2Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const defaultClienteId = sp.clienteId ? parseInt(sp.clienteId) : undefined
  const defaultProyectoId = sp.proyectoId ? parseInt(sp.proyectoId) : undefined

  const [clientes, proyectos] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.proyecto.findMany({
      select: { id: true, nombre: true, clienteId: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/presupuestos"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo Presupuesto</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Constructor por capítulos y partidas
          </p>
        </div>
      </div>

      <PresupuestoV2Builder
        clientes={clientes}
        proyectos={proyectos}
        mode="create"
        defaultClienteId={defaultClienteId}
        defaultProyectoId={defaultProyectoId}
      />
    </div>
  )
}
