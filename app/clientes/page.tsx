import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, Pencil, Trash2, Users, Phone } from 'lucide-react'
import { DeleteClienteButton } from './DeleteClienteButton'
import { SuccessBanner } from '@/components/ui/success-banner'

interface SearchParams {
  search?: string
  msg?: string
}

async function getClientes(search?: string) {
  return prisma.cliente.findMany({
    where: search
      ? {
          OR: [
            { nombre:   { contains: search, mode: 'insensitive' } },
            { correo:   { contains: search, mode: 'insensitive' } },
            { telefono: { contains: search, mode: 'insensitive' } },
            { rnc:      { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      _count: {
        select: { proyectos: true, presupuestos: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

const tipoClienteVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  'Particular': 'default',
  'Empresa': 'info',
  'Arquitecto': 'warning',
  'Inmobiliaria': 'success',
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { search, msg } = await searchParams
  const clientes = await getClientes(search)

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Cliente creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Cliente actualizado exitosamente" />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500 mt-1">{clientes.length} clientes registrados</p>
        </div>
        <Link href="/clientes/nuevo">
          <Button>
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <form method="GET" className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={search || ''}
                placeholder="Buscar por nombre, RNC/cédula, correo o teléfono..."
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button type="submit" variant="secondary">
              <Search className="w-4 h-4" />
              Buscar
            </Button>
            {search && (
              <Link href="/clientes">
                <Button variant="ghost">Limpiar</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No se encontraron clientes</p>
              <p className="text-slate-400 text-sm mt-1">
                {search
                  ? 'Intenta con otro término de búsqueda'
                  : 'Comienza agregando tu primer cliente'}
              </p>
              {!search && (
                <Link href="/clientes/nuevo" className="mt-4">
                  <Button size="sm">
                    <Plus className="w-4 h-4" /> Agregar cliente
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">RNC / Cédula</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fuente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Proyectos</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <Link
                            href={`/clientes/${cliente.id}`}
                            className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                          >
                            {cliente.nombre}
                          </Link>
                          {cliente.correo && (
                            <p className="text-xs text-slate-500 mt-0.5">{cliente.correo}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(cliente as any).rnc ? (
                          <span className="text-sm text-slate-600 font-mono">{(cliente as any).rnc}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cliente.telefono ? (
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {cliente.telefono}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={tipoClienteVariant[cliente.tipoCliente] || 'default'}>
                          {cliente.tipoCliente}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{cliente.fuente}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-700">
                            {cliente._count.proyectos} proyecto{cliente._count.proyectos !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/clientes/${cliente.id}`}>
                            <Button variant="ghost" size="sm" title="Ver detalle">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/clientes/${cliente.id}/editar`}>
                            <Button variant="ghost" size="sm" title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <DeleteClienteButton id={cliente.id} nombre={cliente.nombre} />
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
