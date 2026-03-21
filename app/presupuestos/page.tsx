import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EstadoPresupuestoBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Eye, Pencil, FileText } from 'lucide-react'
import { DeletePresupuestoButton } from './DeletePresupuestoButton'
import { SuccessBanner } from '@/components/ui/success-banner'

interface SearchParams {
  estado?: string
  msg?: string
}

async function getPresupuestos(estado?: string) {
  return prisma.presupuesto.findMany({
    where: estado ? { estado } : undefined,
    include: {
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
      _count: { select: { partidas: true, modulosMelamina: true, capitulos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

const estadoOptions = [
  { value: '', label: 'Todos' },
  { value: 'Borrador', label: 'Borrador' },
  { value: 'Enviado', label: 'Enviado' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
]

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { estado, msg } = await searchParams
  const presupuestos = await getPresupuestos(estado)

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Presupuesto creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Presupuesto actualizado exitosamente" />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presupuestos</h1>
          <p className="text-slate-500 mt-1">{presupuestos.length} presupuestos encontrados</p>
        </div>
        <Link href="/presupuestos/nuevo-v2">
          <Button>
            <Plus className="w-4 h-4" />
            Nueva Cotización
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2 flex-wrap">
            {estadoOptions.map((opt) => (
              <Link
                key={opt.value}
                href={opt.value ? `/presupuestos?estado=${encodeURIComponent(opt.value)}` : '/presupuestos'}
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
          {presupuestos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No hay presupuestos en este estado</p>
              <Link href="/presupuestos/nuevo" className="mt-4">
                <Button size="sm">
                  <Plus className="w-4 h-4" /> Crear presupuesto
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">N° Cotización</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {presupuestos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/presupuestos/${p.id}`}
                          className="text-sm font-semibold text-slate-800 hover:text-blue-600"
                        >
                          {p.numero}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {p._count.capitulos > 0
                            ? `${p._count.capitulos} capítulos (V2)`
                            : `${p._count.partidas} partidas · ${p._count.modulosMelamina} módulos`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/clientes/${p.cliente.id}`}
                          className="text-sm text-slate-600 hover:text-blue-600"
                        >
                          {p.cliente.nombre.split(' ').slice(0, 2).join(' ')}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {p.proyecto ? (
                          <Link href={`/proyectos/${p.proyecto.id}`} className="hover:text-blue-600">
                            {p.proyecto.nombre.length > 30
                              ? p.proyecto.nombre.substring(0, 30) + '...'
                              : p.proyecto.nombre}
                          </Link>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <EstadoPresupuestoBadge estado={p.estado} />
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">
                        {formatCurrency(p.total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/presupuestos/${p.id}`}>
                            <Button variant="ghost" size="sm" title="Ver detalle">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/presupuestos/${p.id}/editar-v2`}>
                            <Button variant="ghost" size="sm" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <DeletePresupuestoButton id={p.id} numero={p.numero} />
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
