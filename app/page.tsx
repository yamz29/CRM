import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EstadoProyectoBadge, EstadoPresupuestoBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Users, FolderOpen, FileText, TrendingUp, ArrowRight, AlertTriangle, Box } from 'lucide-react'
import Link from 'next/link'

async function getDashboardData() {
  const today = new Date()

  const [
    totalClientes,
    proyectosActivos,
    cotizacionesPendientes,
    ventasCerradas,
    tareasVencidas,
    tareasPendientes,
    modulosEnProduccion,
    proyectosRecientes,
    presupuestosRecientes,
    tareasPendientesRecientes,
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.proyecto.count({ where: { estado: { in: ['En Ejecución', 'Adjudicado'] } } }),
    prisma.presupuesto.count({ where: { estado: { in: ['Borrador', 'Enviado'] } } }),
    prisma.presupuesto.aggregate({ where: { estado: 'Aprobado' }, _sum: { total: true } }),
    prisma.tarea.count({
      where: {
        fechaLimite: { lt: today },
        estado: { notIn: ['Completada', 'Cancelada'] },
      },
    }),
    prisma.tarea.count({ where: { estado: 'Pendiente' } }),
    prisma.moduloMelaminaV2.count({
      where: { estadoProduccion: { notIn: ['Instalado', 'Entregado'] } },
    }),
    prisma.proyecto.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { cliente: { select: { nombre: true } } },
    }),
    prisma.presupuesto.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { nombre: true } },
        proyecto: { select: { nombre: true } },
      },
    }),
    prisma.tarea.findMany({
      where: { estado: { in: ['Pendiente', 'En proceso'] } },
      take: 5,
      orderBy: [{ prioridad: 'asc' }, { fechaLimite: 'asc' }],
      include: {
        cliente: { select: { nombre: true } },
        proyecto: { select: { nombre: true } },
      },
    }),
  ])

  return {
    totalClientes,
    proyectosActivos,
    cotizacionesPendientes,
    ventasCerradas: ventasCerradas._sum.total || 0,
    tareasVencidas,
    tareasPendientes,
    modulosEnProduccion,
    proyectosRecientes,
    presupuestosRecientes,
    tareasPendientesRecientes,
  }
}

function getPrioridadBadge(prioridad: string) {
  const map: Record<string, 'danger' | 'warning' | 'success'> = {
    Alta: 'danger',
    Media: 'warning',
    Baja: 'success',
  }
  return <Badge variant={map[prioridad] || 'default' as any}>{prioridad}</Badge>
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const today = new Date()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general del negocio</p>
      </div>

      {/* Stats Cards — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <StatsCard
          title="Total Clientes"
          value={data.totalClientes}
          icon={<Users className="w-5 h-5" />}
          description="Clientes registrados"
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatsCard
          title="Proyectos Activos"
          value={data.proyectosActivos}
          icon={<FolderOpen className="w-5 h-5" />}
          description="En ejecución o adjudicados"
          colorClass="bg-green-50 text-green-600"
        />
        <StatsCard
          title="Cotizaciones Pendientes"
          value={data.cotizacionesPendientes}
          icon={<FileText className="w-5 h-5" />}
          description="Borrador o enviadas"
          colorClass="bg-yellow-50 text-yellow-600"
        />
        <StatsCard
          title="Ventas Cerradas"
          value={formatCurrency(data.ventasCerradas)}
          icon={<TrendingUp className="w-5 h-5" />}
          description="Total presupuestos aprobados"
          colorClass="bg-purple-50 text-purple-600"
        />
        <StatsCard
          title="Tareas Vencidas"
          value={data.tareasVencidas}
          icon={<AlertTriangle className="w-5 h-5" />}
          description="Requieren atención urgente"
          colorClass={data.tareasVencidas > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}
        />
        <StatsCard
          title="Módulos en Producción"
          value={data.modulosEnProduccion}
          icon={<Box className="w-5 h-5" />}
          description="Melamina pendientes de completar"
          colorClass="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Proyectos Recientes</CardTitle>
              <Link
                href="/proyectos"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.proyectosRecientes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No hay proyectos aún</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.proyectosRecientes.map((proyecto) => (
                    <tr key={proyecto.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/proyectos/${proyecto.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors block"
                        >
                          {proyecto.nombre.length > 28
                            ? proyecto.nombre.substring(0, 28) + '...'
                            : proyecto.nombre}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {proyecto.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <EstadoProyectoBadge estado={proyecto.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Recent Budgets */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Presupuestos Recientes</CardTitle>
              <Link
                href="/presupuestos"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.presupuestosRecientes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No hay presupuestos aún</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">N° Cotización</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.presupuestosRecientes.map((presupuesto) => (
                    <tr key={presupuesto.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/presupuestos/${presupuesto.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors block"
                        >
                          {presupuesto.numero}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {presupuesto.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">
                        {formatCurrency(presupuesto.total)}
                      </td>
                      <td className="px-4 py-3">
                        <EstadoPresupuestoBadge estado={presupuesto.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Tareas Pendientes</CardTitle>
              <Link
                href="/tareas"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.tareasPendientesRecientes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sin tareas pendientes</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarea</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vence</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Prior.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tareasPendientesRecientes.map((tarea) => {
                    const isVencida =
                      tarea.fechaLimite &&
                      tarea.fechaLimite < today &&
                      !['Completada', 'Cancelada'].includes(tarea.estado)

                    return (
                      <tr key={tarea.id} className={`hover:bg-slate-50/50 transition-colors ${isVencida ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/tareas/${tarea.id}/editar`}
                            className="text-sm font-medium text-slate-800 hover:text-blue-600 block truncate max-w-36"
                          >
                            {tarea.titulo}
                          </Link>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {tarea.cliente?.nombre.split(' ').slice(0, 2).join(' ') ||
                              tarea.proyecto?.nombre.substring(0, 20) ||
                              'Sin asignar'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {tarea.fechaLimite ? (
                            <span className={`text-xs font-medium ${isVencida ? 'text-red-600' : 'text-slate-600'}`}>
                              {isVencida && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              {formatDate(tarea.fechaLimite)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getPrioridadBadge(tarea.prioridad)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
