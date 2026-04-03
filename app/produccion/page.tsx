import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { Plus, Factory, Clock, PlayCircle, CheckCircle, Package } from 'lucide-react'
import { ProduccionPageClient } from '@/components/produccion/ProduccionPageClient'

interface SearchParams { msg?: string }

export default async function ProduccionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams

  const [ordenes, totalPendientes, totalEnProceso, totalCompletadas, totalItems] =
    await Promise.all([
      prisma.ordenProduccion.findMany({
        include: {
          proyecto: { select: { id: true, nombre: true } },
          items: {
            select: { id: true, etapa: true, completado: true, nombreModulo: true, cantidad: true, prioridad: true },
          },
          _count: { select: { items: true, materiales: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ordenProduccion.count({ where: { estado: 'Pendiente' } }),
      prisma.ordenProduccion.count({ where: { estado: 'En Proceso' } }),
      prisma.ordenProduccion.count({ where: { estado: 'Completada' } }),
      prisma.itemProduccion.count({ where: { completado: false } }),
    ])

  const ordenesSerial = ordenes.map((o) => ({
    ...o,
    fechaInicio: o.fechaInicio?.toISOString() || null,
    fechaEstimada: o.fechaEstimada?.toISOString() || null,
    fechaCompletada: o.fechaCompletada?.toISOString() || null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((i) => ({
      ...i,
    })),
  }))

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Orden de producción creada exitosamente" />}
      {msg === 'eliminado' && <SuccessBanner mensaje="Orden de producción eliminada" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Producción</h1>
          <p className="text-muted-foreground mt-1">
            {ordenes.length} órdenes de producción
          </p>
        </div>
        <Link href="/produccion/nueva">
          <Button><Plus className="w-4 h-4" /> Nueva Orden</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Pendientes"  value={totalPendientes}  icon={<Clock className="w-5 h-5" />}       colorClass="bg-muted text-muted-foreground" />
        <StatsCard title="En Proceso"  value={totalEnProceso}   icon={<PlayCircle className="w-5 h-5" />}  colorClass="bg-blue-500/10 text-blue-500" />
        <StatsCard title="Completadas" value={totalCompletadas} icon={<CheckCircle className="w-5 h-5" />} colorClass="bg-green-500/10 text-green-500" />
        <StatsCard title="Items Activos" value={totalItems}     icon={<Package className="w-5 h-5" />}     colorClass="bg-purple-500/10 text-purple-500" />
      </div>

      {/* Client component: list + kanban */}
      <ProduccionPageClient ordenes={ordenesSerial} />
    </div>
  )
}
