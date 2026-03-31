import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { formatCurrency } from '@/lib/utils'
import { Plus, Box, Pencil, Layers, Package2, Scissors, List, LayoutGrid } from 'lucide-react'
import { DeleteModuloButton } from './DeleteModuloButton'
import { HelpDrawer } from '@/components/help/HelpDrawer'

interface SearchParams {
  msg?: string
  vista?: string
  estado?: string
}

const ESTADOS_PRODUCCION = [
  { key: 'Diseño',       color: 'bg-slate-100 text-slate-700 border-slate-200',      dot: 'bg-slate-400' },
  { key: 'En corte',     color: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-500' },
  { key: 'En canteado',  color: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500' },
  { key: 'En armado',    color: 'bg-orange-100 text-orange-700 border-orange-200',    dot: 'bg-orange-500' },
  { key: 'Instalado',    color: 'bg-green-100 text-green-700 border-green-200',       dot: 'bg-green-500' },
  { key: 'Entregado',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' },
]

function getEstadoBadge(estado: string) {
  const cfg = ESTADOS_PRODUCCION.find(e => e.key === estado)
  const cls = cfg?.color || 'bg-gray-100 text-gray-700 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {estado}
    </span>
  )
}

export default async function MelaminaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { msg, vista = 'lista', estado: filtroEstado } = await searchParams

  const where = filtroEstado ? { estadoProduccion: filtroEstado } : {}

  const [modulos, totalModulos, enProduccion, instalados, conteosPorEstado] = await Promise.all([
    prisma.moduloMelaminaV2.findMany({
      where,
      include: { proyecto: { select: { id: true, nombre: true } } },
      orderBy: [{ estadoProduccion: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.moduloMelaminaV2.count(),
    prisma.moduloMelaminaV2.count({
      where: { estadoProduccion: { notIn: ['Instalado', 'Entregado'] } },
    }),
    prisma.moduloMelaminaV2.count({
      where: { estadoProduccion: { in: ['Instalado', 'Entregado'] } },
    }),
    prisma.moduloMelaminaV2.groupBy({
      by: ['estadoProduccion'],
      _count: true,
    }),
  ])

  const cuentaPorEstado = Object.fromEntries(
    conteosPorEstado.map(c => [c.estadoProduccion, c._count])
  )

  // Group modules by estado for kanban view
  const modulosPorEstado = Object.fromEntries(
    ESTADOS_PRODUCCION.map(e => [
      e.key,
      modulos.filter(m => m.estadoProduccion === e.key),
    ])
  )

  const buildHref = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) { if (v) p.set(k, v) }
    const s = p.toString()
    return `/melamina${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Módulo creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Módulo actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Módulos Melamina</h1>
          <p className="text-muted-foreground mt-1">{modulos.length} módulos {filtroEstado ? `en "${filtroEstado}"` : 'registrados'}</p>
        </div>
        <div className="flex gap-2">
          <HelpDrawer slug="materiales" titulo="Módulos Melamina" />
          <Link href="/melamina/materiales">
            <Button variant="secondary">
              <Package2 className="w-4 h-4" />
              Materiales
            </Button>
          </Link>
          <Link href="/melamina/nuevo">
            <Button>
              <Plus className="w-4 h-4" />
              Nuevo Módulo
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Módulos"
          value={totalModulos}
          icon={<Box className="w-5 h-5" />}
          colorClass="bg-slate-100 text-slate-600"
        />
        <StatsCard
          title="En Producción"
          value={enProduccion}
          icon={<Box className="w-5 h-5" />}
          colorClass="bg-amber-50 text-amber-600"
          description="Pendientes de completar"
        />
        <StatsCard
          title="Instalados / Entregados"
          value={instalados}
          icon={<Box className="w-5 h-5" />}
          colorClass="bg-green-50 text-green-600"
        />
      </div>

      {/* Toolbar: filtro estado + toggle vista */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Filtro por estado */}
        <div className="flex gap-2 flex-wrap">
          <Link
            href={buildHref({ vista })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              !filtroEstado
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
            }`}
          >
            Todos ({totalModulos})
          </Link>
          {ESTADOS_PRODUCCION.map(e => (
            <Link
              key={e.key}
              href={buildHref({ vista, estado: e.key })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filtroEstado === e.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'
              }`}
            >
              {e.key} {cuentaPorEstado[e.key] ? `(${cuentaPorEstado[e.key]})` : '(0)'}
            </Link>
          ))}
        </div>

        {/* Toggle vista */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <Link
            href={buildHref({ vista: 'lista', estado: filtroEstado })}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              vista !== 'produccion'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Lista
          </Link>
          <Link
            href={buildHref({ vista: 'produccion', estado: filtroEstado })}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              vista === 'produccion'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Producción
          </Link>
        </div>
      </div>

      {/* VISTA PRODUCCIÓN — tablero agrupado por estado */}
      {vista === 'produccion' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {ESTADOS_PRODUCCION.map(e => {
            const cols = modulosPorEstado[e.key] ?? []
            return (
              <div key={e.key} className="bg-secondary/40 border border-border rounded-xl overflow-hidden">
                {/* Columna header */}
                <div className={`px-3 py-2 flex items-center gap-2 border-b border-border ${e.color}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${e.dot}`} />
                  <span className="text-xs font-bold truncate">{e.key}</span>
                  <span className="ml-auto text-xs font-bold opacity-70">{cols.length}</span>
                </div>

                {/* Tarjetas */}
                <div className="p-2 space-y-2 min-h-[80px]">
                  {cols.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">—</p>
                  )}
                  {cols.map(m => (
                    <Link key={m.id} href={`/melamina/${m.id}`}>
                      <div className="bg-card border border-border rounded-lg px-3 py-2 hover:border-primary/40 transition-colors cursor-pointer group">
                        <p className="text-xs font-semibold text-foreground group-hover:text-primary truncate">{m.nombre}</p>
                        {m.codigo && (
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{m.codigo}</p>
                        )}
                        {m.proyecto && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">{m.proyecto.nombre}</p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">×{m.cantidad}</span>
                          {m.precioVenta > 0 && (
                            <span className="text-[10px] font-semibold text-foreground">{formatCurrency(m.precioVenta)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VISTA LISTA */}
      {vista !== 'produccion' && (
        <Card>
          <CardContent className="p-0">
            {modulos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Box className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">
                  {filtroEstado ? `No hay módulos en "${filtroEstado}"` : 'No hay módulos registrados'}
                </p>
                {!filtroEstado && (
                  <Link href="/melamina/nuevo" className="mt-4">
                    <Button size="sm">
                      <Plus className="w-4 h-4" /> Nuevo módulo
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proyecto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dimensiones</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Material</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cant.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precio Venta</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {modulos.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                          {m.codigo || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/melamina/${m.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                            {m.nombre}
                          </Link>
                          {m.colorAcabado && (
                            <p className="text-xs text-muted-foreground mt-0.5">{m.colorAcabado}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default">{m.tipoModulo}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {m.proyecto ? (
                            <Link
                              href={`/proyectos/${m.proyecto.id}`}
                              className="text-sm text-muted-foreground hover:text-primary"
                            >
                              {m.proyecto.nombre.length > 25
                                ? m.proyecto.nombre.substring(0, 25) + '...'
                                : m.proyecto.nombre}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground/50 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {m.ancho > 0 || m.alto > 0 || m.profundidad > 0
                            ? `${m.ancho}×${m.alto}×${m.profundidad} cm`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{m.material || '-'}</td>
                        <td className="px-4 py-3">{getEstadoBadge(m.estadoProduccion)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground text-right">{m.cantidad}</td>
                        <td className="px-4 py-3 text-sm font-bold text-foreground text-right">
                          {formatCurrency(m.precioVenta)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Link href={`/melamina/${m.id}`}>
                              <Button variant="ghost" size="sm" title="Ver despiece">
                                <Layers className="w-4 h-4" />
                              </Button>
                            </Link>
                            {m.proyecto && (
                              <Link href={`/melamina/corte?proyecto=${m.proyecto.id}`}>
                                <Button variant="ghost" size="sm" title="Lista de corte del proyecto">
                                  <Scissors className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            <Link href={`/melamina/${m.id}/editar`}>
                              <Button variant="ghost" size="sm" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </Link>
                            <DeleteModuloButton id={m.id} nombre={m.nombre} />
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
      )}
    </div>
  )
}
