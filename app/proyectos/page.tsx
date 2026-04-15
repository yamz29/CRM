import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoProyectoBadge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/stats-card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Eye, Pencil, FolderOpen, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { DeleteProyectoButton } from './DeleteProyectoButton'
import { SuccessBanner } from '@/components/ui/success-banner'
import { HelpDrawer } from '@/components/help/HelpDrawer'
import { ExportButton } from '@/components/ui/export-button'

interface SearchParams {
  estado?: string
  msg?: string
  archivados?: string
}

async function getProyectos(estado?: string, verArchivados = false) {
  return prisma.proyecto.findMany({
    where: {
      ...(estado ? { estado } : {}),
      archivada: verArchivados,
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      _count: { select: { presupuestos: true } },
    },
    orderBy: verArchivados ? { fechaArchivada: 'desc' } : { createdAt: 'desc' },
  })
}

async function getStats() {
  const [total, enEjecucion, adjudicados, terminados, archivadosCount] = await Promise.all([
    prisma.proyecto.count({ where: { archivada: false } }),
    prisma.proyecto.count({ where: { estado: 'En Ejecución', archivada: false } }),
    prisma.proyecto.count({ where: { estado: 'Adjudicado', archivada: false } }),
    prisma.proyecto.count({ where: { estado: 'Terminado', archivada: false } }),
    prisma.proyecto.count({ where: { archivada: true } }),
  ])
  return { total, enEjecucion, adjudicados, terminados, archivadosCount }
}

const estadoOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'Prospecto', label: 'Prospecto' },
  { value: 'En Cotización', label: 'En Cotización' },
  { value: 'Adjudicado', label: 'Adjudicado' },
  { value: 'En Ejecución', label: 'En Ejecución' },
  { value: 'Terminado', label: 'Terminado' },
  { value: 'Cancelado', label: 'Cancelado' },
]

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { estado, msg, archivados } = await searchParams
  const verArchivados = archivados === '1'
  const [proyectos, stats] = await Promise.all([
    getProyectos(estado, verArchivados),
    getStats(),
  ])

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Proyecto creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Proyecto actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proyectos</h1>
          <p className="text-muted-foreground mt-1">{proyectos.length} proyectos encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpDrawer slug="proyectos" titulo="Proyectos" />
          <ExportButton href="/api/export/proyectos" label="Exportar" />
          <Link href="/proyectos/nuevo">
            <Button>
              <Plus className="w-4 h-4" />
              Nuevo Proyecto
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Proyectos"
          value={stats.total}
          icon={<FolderOpen className="w-5 h-5" />}
          colorClass="bg-muted text-muted-foreground"
        />
        <StatsCard
          title="En Ejecución"
          value={stats.enEjecucion}
          icon={<TrendingUp className="w-5 h-5" />}
          colorClass="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Adjudicados"
          value={stats.adjudicados}
          icon={<Clock className="w-5 h-5" />}
          colorClass="bg-yellow-500/10 text-yellow-500"
        />
        <StatsCard
          title="Terminados"
          value={stats.terminados}
          icon={<CheckCircle className="w-5 h-5" />}
          colorClass="bg-blue-500/10 text-blue-500"
        />
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {estadoOptions.map((opt) => {
                const params = new URLSearchParams()
                if (opt.value) params.set('estado', opt.value)
                if (verArchivados) params.set('archivados', '1')
                const href = params.toString() ? `/proyectos?${params.toString()}` : '/proyectos'
                return (
                  <Link
                    key={opt.value}
                    href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      estado === opt.value || (!estado && opt.value === '')
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {opt.label}
                  </Link>
                )
              })}
            </div>
            <Link
              href={verArchivados
                ? (estado ? `/proyectos?estado=${encodeURIComponent(estado)}` : '/proyectos')
                : (estado ? `/proyectos?estado=${encodeURIComponent(estado)}&archivados=1` : '/proyectos?archivados=1')
              }
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                verArchivados
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {verArchivados ? 'Ocultando activos' : `Ver archivados (${stats.archivadosCount})`}
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {proyectos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No hay proyectos en este estado</p>
              <Link href="/proyectos/nuevo" className="mt-4">
                <Button size="sm">
                  <Plus className="w-4 h-4" /> Crear proyecto
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inicio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Presupuesto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Avance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {proyectos.map((proyecto) => (
                    <tr key={proyecto.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/proyectos/${proyecto.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {proyecto.nombre}
                        </Link>
                        {proyecto.ubicacion && (
                          <p className="text-xs text-muted-foreground mt-0.5">{proyecto.ubicacion}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${proyecto.cliente.id}`}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {proyecto.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{proyecto.tipoProyecto}</td>
                      <td className="px-4 py-3">
                        <EstadoProyectoBadge estado={proyecto.estado} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {proyecto.fechaInicio ? formatDate(proyecto.fechaInicio) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground tabular-nums">
                        {proyecto.presupuestoEstimado
                          ? formatCurrency(proyecto.presupuestoEstimado)
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {(proyecto as any).avanceFisico > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(proyecto as any).avanceFisico}%`,
                                  backgroundColor: (proyecto as any).avanceFisico === 100 ? '#22c55e' : (proyecto as any).avanceFisico >= 50 ? '#3b82f6' : '#f59e0b',
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{(proyecto as any).avanceFisico}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/proyectos/${proyecto.id}`}>
                            <Button variant="ghost" size="sm" title="Ver detalle">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/proyectos/${proyecto.id}/editar`}>
                            <Button variant="ghost" size="sm" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <DeleteProyectoButton id={proyecto.id} nombre={proyecto.nombre} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
