import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EstadoPresupuestoBadge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Eye, Pencil, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { DeletePresupuestoButton } from './DeletePresupuestoButton'
import { SuccessBanner } from '@/components/ui/success-banner'
import { PresupuestosBuscador } from './PresupuestosBuscador'

const PER_PAGE = 20

interface SearchParams {
  estado?: string
  msg?: string
  q?: string
  page?: string
}

async function getPresupuestos(estado?: string, q?: string, page = 1) {
  const skip = (page - 1) * PER_PAGE

  const where = {
    ...(estado ? { estado } : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: q, mode: 'insensitive' as const } },
            { cliente: { nombre: { contains: q, mode: 'insensitive' as const } } },
            { proyecto: { nombre: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const [presupuestos, total] = await Promise.all([
    prisma.presupuesto.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        _count: { select: { partidas: true, modulosMelamina: true, capitulos: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: PER_PAGE,
      skip,
    }),
    prisma.presupuesto.count({ where }),
  ])

  return { presupuestos, total, totalPages: Math.ceil(total / PER_PAGE) }
}

const estadoOptions = [
  { value: '', label: 'Todos' },
  { value: 'Borrador', label: 'Borrador' },
  { value: 'Enviado', label: 'Enviado' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
]

function buildHref(params: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v)
  }
  const s = p.toString()
  return `/presupuestos${s ? `?${s}` : ''}`
}

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { estado, msg, q, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1') || 1)
  const { presupuestos, total, totalPages } = await getPresupuestos(estado, q, page)

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Presupuesto creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Presupuesto actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Presupuestos</h1>
          <p className="text-muted-foreground mt-1">
            {total} {total === 1 ? 'presupuesto' : 'presupuestos'}
            {q ? ` para "${q}"` : ''}
            {estado ? ` · ${estado}` : ''}
          </p>
        </div>
        <Link href="/presupuestos/nuevo-v2">
          <Button>
            <Plus className="w-4 h-4" />
            Nuevo Presupuesto
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 space-y-3">
          {/* Búsqueda */}
          <PresupuestosBuscador q={q} estado={estado} />

          {/* Estado tabs */}
          <div className="flex gap-2 flex-wrap">
            {estadoOptions.map((opt) => (
              <Link
                key={opt.value}
                href={buildHref({ estado: opt.value || undefined, q })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  estado === opt.value || (!estado && opt.value === '')
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
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
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">
                {q ? `Sin resultados para "${q}"` : 'No hay presupuestos en este estado'}
              </p>
              {!q && (
                <Link href="/presupuestos/nuevo-v2" className="mt-4">
                  <Button size="sm">
                    <Plus className="w-4 h-4" /> Crear presupuesto
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Cotización</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {presupuestos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/presupuestos/${p.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {p.numero}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p._count.capitulos > 0
                          ? `${p._count.capitulos} capítulos (V2)`
                          : `${p._count.partidas} partidas · ${p._count.modulosMelamina} módulos`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clientes/${p.cliente.id}`}
                        title={p.cliente.nombre}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors block max-w-[200px] truncate"
                      >
                        {p.cliente.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.proyecto ? (
                        <Link
                          href={`/proyectos/${p.proyecto.id}`}
                          title={p.proyecto.nombre}
                          className="hover:text-primary transition-colors block max-w-[220px] truncate"
                        >
                          {p.proyecto.nombre}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <EstadoPresupuestoBadge estado={p.estado} />
                    </TableCell>
                    <TableCell className="text-sm font-bold text-foreground tabular-nums">
                      {formatCurrency(p.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/presupuestos/${p.id}`}>
                          <Button variant="ghost" size="sm" title="Ver detalle" aria-label={`Ver presupuesto ${p.numero}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/presupuestos/${p.id}/editar-v2`}>
                          <Button variant="ghost" size="sm" title="Editar" aria-label={`Editar presupuesto ${p.numero}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <DeletePresupuestoButton id={p.id} numero={p.numero} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} · {total} resultados
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={buildHref({ estado, q, page: String(page - 1) })}>
                <Button variant="secondary" size="sm" className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" disabled className="gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
            )}
            {page < totalPages ? (
              <Link href={buildHref({ estado, q, page: String(page + 1) })}>
                <Button variant="secondary" size="sm" className="gap-1">
                  Siguiente <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" size="sm" disabled className="gap-1">
                Siguiente <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
