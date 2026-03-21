import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { formatDate } from '@/lib/utils'
import { Plus, CheckSquare, AlertTriangle, Clock, CheckCircle, XCircle, Pencil } from 'lucide-react'
import { DeleteTareaButton } from './DeleteTareaButton'

interface SearchParams {
  msg?: string
  estado?: string
}

const ESTADOS_FILTER = ['Todas', 'Pendiente', 'En proceso', 'Completada', 'Cancelada']

function getPrioridadBadge(prioridad: string) {
  const map: Record<string, { variant: 'danger' | 'warning' | 'success'; label: string }> = {
    Alta: { variant: 'danger', label: 'Alta' },
    Media: { variant: 'warning', label: 'Media' },
    Baja: { variant: 'success', label: 'Baja' },
  }
  const cfg = map[prioridad] || { variant: 'default' as any, label: prioridad }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function getEstadoBadge(estado: string) {
  const map: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
    Pendiente: 'default',
    'En proceso': 'info',
    Completada: 'success',
    Cancelada: 'danger',
  }
  return <Badge variant={map[estado] || 'default'}>{estado}</Badge>
}

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { msg, estado: estadoFilter } = await searchParams

  const today = new Date()

  const [tareas, totalPendientes, totalEnProceso, totalCompletadas, totalVencidas] =
    await Promise.all([
      prisma.tarea.findMany({
        where:
          estadoFilter && estadoFilter !== 'Todas' ? { estado: estadoFilter } : undefined,
        include: {
          cliente: { select: { id: true, nombre: true } },
          proyecto: { select: { id: true, nombre: true } },
        },
        orderBy: [{ prioridad: 'asc' }, { fechaLimite: 'asc' }],
      }),
      prisma.tarea.count({ where: { estado: 'Pendiente' } }),
      prisma.tarea.count({ where: { estado: 'En proceso' } }),
      prisma.tarea.count({ where: { estado: 'Completada' } }),
      prisma.tarea.count({
        where: {
          fechaLimite: { lt: today },
          estado: { notIn: ['Completada', 'Cancelada'] },
        },
      }),
    ])

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Tarea creada exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Tarea actualizada exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tareas</h1>
          <p className="text-slate-500 mt-1">{tareas.length} tareas encontradas</p>
        </div>
        <Link href="/tareas/nueva">
          <Button>
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Pendientes"
          value={totalPendientes}
          icon={<Clock className="w-5 h-5" />}
          colorClass="bg-slate-100 text-slate-600"
        />
        <StatsCard
          title="En proceso"
          value={totalEnProceso}
          icon={<CheckSquare className="w-5 h-5" />}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatsCard
          title="Completadas"
          value={totalCompletadas}
          icon={<CheckCircle className="w-5 h-5" />}
          colorClass="bg-green-50 text-green-600"
        />
        <StatsCard
          title="Vencidas"
          value={totalVencidas}
          icon={<AlertTriangle className="w-5 h-5" />}
          colorClass={totalVencidas > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}
        />
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="py-3">
          <div className="flex gap-2 flex-wrap">
            {ESTADOS_FILTER.map((s) => {
              const isActive =
                s === 'Todas'
                  ? !estadoFilter || estadoFilter === 'Todas'
                  : estadoFilter === s
              return (
                <Link
                  key={s}
                  href={s === 'Todas' ? '/tareas' : `/tareas?estado=${encodeURIComponent(s)}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {tareas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay tareas en este estado</p>
              <Link href="/tareas/nueva" className="mt-4">
                <Button size="sm">
                  <Plus className="w-4 h-4" /> Nueva tarea
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioridad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente / Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vence</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsable</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tareas.map((tarea) => {
                    const isVencida =
                      tarea.fechaLimite &&
                      tarea.fechaLimite < today &&
                      !['Completada', 'Cancelada'].includes(tarea.estado)

                    return (
                      <tr
                        key={tarea.id}
                        className={`hover:bg-slate-50/50 transition-colors ${
                          isVencida ? 'bg-red-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {isVencida && (
                              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-800">{tarea.titulo}</p>
                              {tarea.descripcion && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                  {tarea.descripcion}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getPrioridadBadge(tarea.prioridad)}</td>
                        <td className="px-4 py-3">{getEstadoBadge(tarea.estado)}</td>
                        <td className="px-4 py-3">
                          {tarea.cliente && (
                            <Link
                              href={`/clientes/${tarea.cliente.id}`}
                              className="text-sm text-slate-600 hover:text-blue-600 block"
                            >
                              {tarea.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                            </Link>
                          )}
                          {tarea.proyecto && (
                            <Link
                              href={`/proyectos/${tarea.proyecto.id}`}
                              className="text-xs text-slate-400 hover:text-blue-600"
                            >
                              {tarea.proyecto.nombre.length > 30
                                ? tarea.proyecto.nombre.substring(0, 30) + '...'
                                : tarea.proyecto.nombre}
                            </Link>
                          )}
                          {!tarea.cliente && !tarea.proyecto && (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {tarea.fechaLimite ? (
                            <span
                              className={`text-sm font-medium ${
                                isVencida ? 'text-red-600' : 'text-slate-600'
                              }`}
                            >
                              {formatDate(tarea.fechaLimite)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {tarea.responsable || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link href={`/tareas/${tarea.id}/editar`}>
                              <Button variant="ghost" size="sm" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </Link>
                            <DeleteTareaButton id={tarea.id} titulo={tarea.titulo} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
