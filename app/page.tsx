import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/ui/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EstadoProyectoBadge, EstadoPresupuestoBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Users, FolderOpen, FileText, TrendingUp, ArrowRight, AlertTriangle, Box, Target, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { PeriodoSelector } from '@/components/dashboard/PeriodoSelector'

// ── Helpers ────────────────────────────────────────────────────────────────────

type Periodo = 'hoy' | 'semana' | 'mes' | 'ano' | 'todo'

function getDesde(periodo: Periodo): Date | null {
  const now = new Date()
  if (periodo === 'hoy')    { const d = new Date(now); d.setHours(0,0,0,0); return d }
  if (periodo === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 7);         return d }
  if (periodo === 'mes')    { const d = new Date(now); d.setDate(d.getDate() - 30);         return d }
  if (periodo === 'ano')    { const d = new Date(now); d.setFullYear(d.getFullYear() - 1);  return d }
  return null // todo
}

// ── Data fetching (cacheado por período) ────────────────────────────────────────

function getDashboardData(periodo: Periodo) {
  return unstable_cache(
    async () => {
      const today = new Date()
      const desde = getDesde(periodo)
      const rangoFecha = desde ? { gte: desde } : undefined

      const [
        totalClientes,
        proyectosActivos,
        cotizacionesPendientes,
        ventasCerradas,
        tareasVencidas,
        modulosEnProduccion,
        proyectosRecientes,
        presupuestosRecientes,
        tareasPendientesRecientes,
        oportunidadesActivas,
        valorPipelineAgg,
        oportunidadesGanadas,
        oportunidadesPerdidas,
      ] = await Promise.all([
        prisma.cliente.count(),
        prisma.proyecto.count({ where: { estado: { in: ['En Ejecución', 'Adjudicado'] } } }),
        prisma.presupuesto.count({ where: { estado: { in: ['Borrador', 'Enviado'] } } }),
        prisma.presupuesto.aggregate({
          where: { estado: 'Aprobado', ...(rangoFecha ? { updatedAt: rangoFecha } : {}) },
          _sum: { total: true },
        }),
        prisma.tarea.count({
          where: {
            fechaLimite: { lt: today },
            estado: { notIn: ['Completada', 'Cancelada'] },
          },
        }),
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
        prisma.oportunidad.count({ where: { etapa: { notIn: ['Ganado', 'Perdido'] } } }),
        prisma.oportunidad.aggregate({
          where: { etapa: { notIn: ['Ganado', 'Perdido'] }, valor: { not: null } },
          _sum: { valor: true },
        }),
        prisma.oportunidad.count({
          where: { etapa: 'Ganado', ...(rangoFecha ? { updatedAt: rangoFecha } : {}) },
        }),
        prisma.oportunidad.count({
          where: { etapa: 'Perdido', ...(rangoFecha ? { updatedAt: rangoFecha } : {}) },
        }),
      ])

      const cerradas   = oportunidadesGanadas + oportunidadesPerdidas
      const tasaCierre = cerradas > 0 ? Math.round((oportunidadesGanadas / cerradas) * 100) : null

      return {
        totalClientes,
        proyectosActivos,
        cotizacionesPendientes,
        ventasCerradas: ventasCerradas._sum.total || 0,
        tareasVencidas,
        modulosEnProduccion,
        proyectosRecientes,
        presupuestosRecientes,
        tareasPendientesRecientes,
        oportunidadesActivas,
        valorPipeline: valorPipelineAgg._sum.valor ?? 0,
        oportunidadesGanadas,
        tasaCierre,
      }
    },
    [`dashboard-data-${periodo}`],
    { revalidate: 60 }
  )()
}

function getPrioridadBadge(prioridad: string) {
  const map: Record<string, 'danger' | 'warning' | 'success'> = {
    Alta: 'danger', Media: 'warning', Baja: 'success',
  }
  return <Badge variant={map[prioridad] || 'default' as any}>{prioridad}</Badge>
}

const PERIODO_LABEL: Record<Periodo, string> = {
  hoy:    'hoy',
  semana: 'últimos 7 días',
  mes:    'últimos 30 días',
  ano:    'últimos 12 meses',
  todo:   'histórico',
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const { periodo: periodoRaw } = await searchParams
  const periodo = (['hoy','semana','mes','ano','todo'].includes(periodoRaw ?? '') ? periodoRaw : 'mes') as Periodo
  const data    = await getDashboardData(periodo)
  const today   = new Date()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Métricas de actividad — <span className="font-medium">{PERIODO_LABEL[periodo]}</span>
          </p>
        </div>
        <Suspense>
          <PeriodoSelector />
        </Suspense>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <StatsCard
          title="Total Clientes"
          value={data.totalClientes}
          icon={<Users className="w-5 h-5" />}
          description="Clientes registrados"
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Proyectos Activos"
          value={data.proyectosActivos}
          icon={<FolderOpen className="w-5 h-5" />}
          description="En ejecución o adjudicados"
          colorClass="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Cotizaciones Pendientes"
          value={data.cotizacionesPendientes}
          icon={<FileText className="w-5 h-5" />}
          description="Borrador o enviadas"
          colorClass="bg-yellow-500/10 text-yellow-500"
        />
        <StatsCard
          title="Ventas Cerradas"
          value={formatCurrency(data.ventasCerradas)}
          icon={<TrendingUp className="w-5 h-5" />}
          description={`Presupuestos aprobados — ${PERIODO_LABEL[periodo]}`}
          colorClass="bg-purple-500/10 text-purple-500"
        />
        <StatsCard
          title="Tareas Vencidas"
          value={data.tareasVencidas}
          icon={<AlertTriangle className="w-5 h-5" />}
          description="Requieren atención urgente"
          colorClass={data.tareasVencidas > 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}
        />
        <StatsCard
          title="Módulos en Producción"
          value={data.modulosEnProduccion}
          icon={<Box className="w-5 h-5" />}
          description="Melamina pendientes de completar"
          colorClass="bg-amber-500/10 text-amber-500"
        />
        <StatsCard
          title="Pipeline Activo"
          value={data.oportunidadesActivas}
          icon={<TrendingUp className="w-5 h-5" />}
          description="Oportunidades en curso"
          colorClass="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Valor Pipeline"
          value={formatCurrency(data.valorPipeline)}
          icon={<DollarSign className="w-5 h-5" />}
          description="Valor estimado de oportunidades activas"
          colorClass="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Tasa de Cierre"
          value={data.tasaCierre !== null ? `${data.tasaCierre}%` : '—'}
          icon={<Target className="w-5 h-5" />}
          description={`Oportunidades ganadas — ${PERIODO_LABEL[periodo]}`}
          colorClass="bg-purple-500/10 text-purple-500"
        />
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Proyectos Recientes</CardTitle>
              <Link href="/proyectos" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.proyectosRecientes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No hay proyectos aún</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.proyectosRecientes.map((proyecto) => (
                    <tr key={proyecto.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/proyectos/${proyecto.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors block">
                          {proyecto.nombre.length > 28 ? proyecto.nombre.substring(0, 28) + '...' : proyecto.nombre}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
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
              <Link href="/presupuestos" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.presupuestosRecientes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No hay presupuestos aún</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">N° Cotización</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.presupuestosRecientes.map((presupuesto) => (
                    <tr key={presupuesto.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/presupuestos/${presupuesto.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors block">
                          {presupuesto.numero}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {presupuesto.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-foreground text-right tabular-nums">
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
              <Link href="/tareas" className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-medium transition-colors">
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.tareasPendientesRecientes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sin tareas pendientes</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Tarea</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Vence</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">Prior.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.tareasPendientesRecientes.map((tarea) => {
                    const isVencida =
                      tarea.fechaLimite &&
                      tarea.fechaLimite < today &&
                      !['Completada', 'Cancelada'].includes(tarea.estado)

                    return (
                      <tr key={tarea.id} className={`hover:bg-muted/30 transition-colors ${isVencida ? 'bg-red-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <Link href={`/tareas/${tarea.id}/editar`} className="text-sm font-medium text-foreground hover:text-primary block truncate max-w-36 transition-colors">
                            {tarea.titulo}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {tarea.cliente?.nombre.split(' ').slice(0, 2).join(' ') ||
                              tarea.proyecto?.nombre.substring(0, 20) ||
                              'Sin asignar'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {tarea.fechaLimite ? (
                            <span className={`text-xs font-medium ${isVencida ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {isVencida && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              {formatDate(tarea.fechaLimite)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
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
