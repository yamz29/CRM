import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Plus, Search, Eye, Pencil, Users, Phone } from 'lucide-react'
import { DeleteClienteButton } from './DeleteClienteButton'
import { SuccessBanner } from '@/components/ui/success-banner'
import { ExportButton } from '@/components/ui/export-button'

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
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">{clientes.length} clientes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton href="/api/export/clientes" label="Exportar" />
          <Link href="/clientes/nuevo">
            <Button>
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <form method="GET" className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                name="search"
                defaultValue={search || ''}
                placeholder="Buscar por nombre, RNC/cédula, correo o teléfono..."
                className="pl-9"
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
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No se encontraron clientes</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>RNC / Cédula</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Proyectos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {cliente.nombre}
                      </Link>
                      {cliente.correo && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cliente.correo}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {(cliente as any).rnc ? (
                        <span className="text-sm text-muted-foreground font-mono">{(cliente as any).rnc}</span>
                      ) : (
                        <span className="text-muted-foreground/50 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cliente.telefono ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {cliente.telefono}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tipoClienteVariant[cliente.tipoCliente] || 'default'}>
                        {cliente.tipoCliente}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cliente.fuente}</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {cliente._count.proyectos} proyecto{cliente._count.proyectos !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/clientes/${cliente.id}`}>
                          <Button variant="ghost" size="sm" title="Ver detalle" aria-label={`Ver detalle de ${cliente.nombre}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/clientes/${cliente.id}/editar`}>
                          <Button variant="ghost" size="sm" title="Editar" aria-label={`Editar ${cliente.nombre}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <DeleteClienteButton id={cliente.id} nombre={cliente.nombre} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
