'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { Search, Eye, Pencil, Users, Phone, X } from 'lucide-react'
import { DeleteClienteButton } from '@/app/clientes/DeleteClienteButton'

interface Cliente {
  id: number
  nombre: string
  correo: string | null
  telefono: string | null
  rnc: string | null
  tipoCliente: string
  fuente: string
  _count: { proyectos: number; presupuestos: number }
}

const tipoClienteVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  'Particular': 'default',
  'Empresa': 'info',
  'Arquitecto': 'warning',
  'Inmobiliaria': 'success',
}

export function ClientesPageClient({ clientes }: { clientes: Cliente[] }) {
  const [filters, setFilters] = useUrlFilters({ search: '' })
  const search = filters.search

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return clientes
    return clientes.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      (c.correo?.toLowerCase().includes(q) ?? false) ||
      (c.telefono?.toLowerCase().includes(q) ?? false) ||
      (c.rnc?.toLowerCase().includes(q) ?? false)
    )
  }, [clientes, search])

  return (
    <>
      {/* Búsqueda instantánea (cliente, URL-driven) */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setFilters({ search: e.target.value })}
                placeholder="Buscar por nombre, RNC/cédula, correo o teléfono..."
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => setFilters({ search: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} de {clientes.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No se encontraron clientes</p>
              <p className="text-muted-foreground/70 text-sm mt-1">
                {search ? 'Intenta con otro término de búsqueda' : 'Comienza agregando tu primer cliente'}
              </p>
              {!search && (
                <Link href="/clientes/nuevo" className="mt-4">
                  <Button size="sm">Agregar cliente</Button>
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
                {filtered.map((cliente) => (
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
                      {cliente.rnc ? (
                        <span className="text-sm text-muted-foreground font-mono">{cliente.rnc}</span>
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
    </>
  )
}
