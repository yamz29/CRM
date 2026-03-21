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

interface SearchParams {
  estado?: string
  msg?: string
}

async function getProyectos(estado?: string) {
  return prisma.proyecto.findMany({
    where: estado ? { estado } : undefined,
    include: {
      cliente: { select: { id: true, nombre: true } },
      _count: { select: { presupuestos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

async function getStats() {
  const [total, enEjecucion, adjudicados, terminados] = await Promise.all([
    prisma.proyecto.count(),
    prisma.proyecto.count({ where: { estado: 'En Ejecución' } }),
    prisma.proyecto.count({ where: { estado: 'Adjudicado' } }),
    prisma.proyecto.count({ where: { estado: 'Terminado' } }),
  ])
  return { total, enEjecucion, adjudicados, terminados }
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
  const { estado, msg } = await searchParams
  const [proyectos, stats] = await Promise.all([
    getProyectos(estado),
    getStats(),
  ])

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Proyecto creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Proyecto actualizado exitosamente" />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proyectos</h1>
          <p className="text-slate-500 mt-1">{proyectos.length} proyectos encontrados</p>
        </div>
        <Link href="/proyectos/nuevo">
          <Button>
            <Plus className="w-4 h-4" />
            Nuevo Proyecto
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total Proyectos"
          value={stats.total}
          icon={<FolderOpen className="w-5 h-5" />}
          colorClass="bg-slate-100 text-slate-600"
        />
        <StatsCard
          title="En Ejecución"
          value={stats.enEjecucion}
          icon={<TrendingUp className="w-5 h-5" />}
          colorClass="bg-green-50 text-green-600"
        />
        <StatsCard
          title="Adjudicados"
          value={stats.adjudicados}
          icon={<Clock className="w-5 h-5" />}
          colorClass="bg-yellow-50 text-yellow-600"
        />
        <StatsCard
          title="Terminados"
          value={stats.terminados}
          icon={<CheckCircle className="w-5 h-5" />}
          colorClass="bg-blue-50 text-blue-600"
        />
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2 flex-wrap">
            {estadoOptions.map((opt) => (
              <Link
                key={opt.value}
                href={opt.value ? `/proyectos?estado=${encodeURIComponent(opt.value)}` : '/proyectos'}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  estado === opt.value || (!estado && opt.value === '')
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {proyectos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay proyectos en este estado</p>
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
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Inicio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Presupuesto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proyectos.map((proyecto) => (
                    <tr key={proyecto.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/proyectos/${proyecto.id}`}
                          className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                        >
                          {proyecto.nombre}
                        </Link>
                        {proyecto.ubicacion && (
                          <p className="text-xs text-slate-500 mt-0.5">{proyecto.ubicacion}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${proyecto.cliente.id}`}
                          className="text-sm text-slate-600 hover:text-blue-600"
                        >
                          {proyecto.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{proyecto.tipoProyecto}</td>
                      <td className="px-4 py-3">
                        <EstadoProyectoBadge estado={proyecto.estado} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {proyecto.fechaInicio ? formatDate(proyecto.fechaInicio) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">
                        {proyecto.presupuestoEstimado
                          ? formatCurrency(proyecto.presupuestoEstimado)
                          : '-'}
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
