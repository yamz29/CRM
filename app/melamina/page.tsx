import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatsCard } from '@/components/ui/stats-card'
import { SuccessBanner } from '@/components/ui/success-banner'
import { formatCurrency } from '@/lib/utils'
import { Plus, Box, Pencil, Layers, Package2 } from 'lucide-react'
import { DeleteModuloButton } from './DeleteModuloButton'

interface SearchParams {
  msg?: string
}

function getEstadoBadge(estado: string) {
  const map: Record<string, string> = {
    'Diseño': 'bg-slate-100 text-slate-700 border-slate-200',
    'En corte': 'bg-blue-100 text-blue-700 border-blue-200',
    'En canteado': 'bg-amber-100 text-amber-700 border-amber-200',
    'En armado': 'bg-orange-100 text-orange-700 border-orange-200',
    'Instalado': 'bg-green-100 text-green-700 border-green-200',
    'Entregado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }
  const cls = map[estado] || 'bg-gray-100 text-gray-700 border-gray-200'
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
  const { msg } = await searchParams

  const [modulos, totalModulos, enProduccion, instalados] = await Promise.all([
    prisma.moduloMelaminaV2.findMany({
      include: { proyecto: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.moduloMelaminaV2.count(),
    prisma.moduloMelaminaV2.count({
      where: { estadoProduccion: { notIn: ['Instalado', 'Entregado'] } },
    }),
    prisma.moduloMelaminaV2.count({
      where: { estadoProduccion: { in: ['Instalado', 'Entregado'] } },
    }),
  ])

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Módulo creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Módulo actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Módulos Melamina</h1>
          <p className="text-slate-500 mt-1">{modulos.length} módulos registrados</p>
        </div>
        <div className="flex gap-2">
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {modulos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Box className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay módulos registrados</p>
              <Link href="/melamina/nuevo" className="mt-4">
                <Button size="sm">
                  <Plus className="w-4 h-4" /> Nuevo módulo
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Dimensiones</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Cant.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio Venta</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modulos.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono">
                        {m.codigo || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/melamina/${m.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                          {m.nombre}
                        </Link>
                        {m.colorAcabado && (
                          <p className="text-xs text-slate-500 mt-0.5">{m.colorAcabado}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">{m.tipoModulo}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {m.proyecto ? (
                          <Link
                            href={`/proyectos/${m.proyecto.id}`}
                            className="text-sm text-slate-600 hover:text-blue-600"
                          >
                            {m.proyecto.nombre.length > 25
                              ? m.proyecto.nombre.substring(0, 25) + '...'
                              : m.proyecto.nombre}
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {m.ancho > 0 || m.alto > 0 || m.profundidad > 0
                          ? `${m.ancho}×${m.alto}×${m.profundidad} cm`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{m.material || '-'}</td>
                      <td className="px-4 py-3">{getEstadoBadge(m.estadoProduccion)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right">{m.cantidad}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">
                        {formatCurrency(m.precioVenta)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/melamina/${m.id}`}>
                            <Button variant="ghost" size="sm" title="Ver despiece">
                              <Layers className="w-4 h-4" />
                            </Button>
                          </Link>
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
    </div>
  )
}
