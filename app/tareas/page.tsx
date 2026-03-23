import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { Plus, CheckSquare, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { TareasPageClient } from '@/components/tareas/TareasPageClient'

interface SearchParams { msg?: string }

export default async function TareasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams
  const today = new Date()

  const [tareas, usuarios, totalPendientes, totalEnProceso, totalCompletadas, totalVencidas] =
    await Promise.all([
      prisma.tarea.findMany({
        include: {
          cliente: { select: { id: true, nombre: true } },
          proyecto: { select: { id: true, nombre: true } },
          asignado: { select: { id: true, nombre: true } },
        },
        orderBy: [{ prioridad: 'asc' }, { fechaLimite: 'asc' }],
      }),
      prisma.usuario.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      prisma.tarea.count({ where: { estado: 'Pendiente' } }),
      prisma.tarea.count({ where: { estado: 'En proceso' } }),
      prisma.tarea.count({ where: { estado: 'Completada' } }),
      prisma.tarea.count({
        where: { fechaLimite: { lt: today }, estado: { notIn: ['Completada', 'Cancelada'] } },
      }),
    ])

  // Serialize dates to strings for client component
  const tareasSerial = tareas.map((t) => ({
    ...t,
    fechaLimite: t.fechaLimite ? t.fechaLimite.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Tarea creada exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Tarea actualizada exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tareas</h1>
          <p className="text-slate-500 mt-1">{tareas.length} tareas registradas</p>
        </div>
        <Link href="/tareas/nueva">
          <Button><Plus className="w-4 h-4" /> Nueva Tarea</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Pendientes"  value={totalPendientes}  icon={<Clock className="w-5 h-5" />}         colorClass="bg-slate-100 text-slate-600" />
        <StatsCard title="En proceso"  value={totalEnProceso}   icon={<CheckSquare className="w-5 h-5" />}   colorClass="bg-blue-50 text-blue-600" />
        <StatsCard title="Completadas" value={totalCompletadas} icon={<CheckCircle className="w-5 h-5" />}   colorClass="bg-green-50 text-green-600" />
        <StatsCard title="Vencidas"    value={totalVencidas}    icon={<AlertTriangle className="w-5 h-5" />} colorClass={totalVencidas > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'} />
      </div>

      {/* Interactive: filtros + lista/kanban */}
      <TareasPageClient tareas={tareasSerial as any} usuarios={usuarios} />
    </div>
  )
}
