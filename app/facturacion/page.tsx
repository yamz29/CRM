import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { FacturacionClient } from './FacturacionClient'
import { Button } from '@/components/ui/button'
import { Plus, FileText } from 'lucide-react'

const PER_PAGE = 50

interface SearchParams {
  estado?: string   // pendiente | parcial | pagada | anulada | proforma | (vacío = todas)
  q?: string
  desde?: string    // YYYY-MM-DD
  hasta?: string    // YYYY-MM-DD
  page?: string
}

function buildWhere({ estado, q, desde, hasta }: SearchParams) {
  return {
    tipo: 'ingreso' as const,
    ...(estado === 'proforma'
      ? { esProforma: true }
      : estado
        ? { estado }
        : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: q, mode: 'insensitive' as const } },
            { ncf: { contains: q, mode: 'insensitive' as const } },
            { descripcion: { contains: q, mode: 'insensitive' as const } },
            { cliente: { nombre: { contains: q, mode: 'insensitive' as const } } },
            { proyecto: { nombre: { contains: q, mode: 'insensitive' as const } } },
            { proyecto: { codigo: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
            ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
          },
        }
      : {}),
  }
}

/**
 * /facturacion — vista enfocada en EMISIÓN de facturas a clientes (ingresos).
 *
 * Distinta a /contabilidad/facturas que mezcla ingresos + egresos. Aquí solo
 * vemos lo que YO emito (cobranza). Para registrar facturas de proveedores
 * el usuario va a Contabilidad.
 *
 * Permiso: 'contabilidad' (mismo que el resto del módulo financiero).
 */
export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1') || 1)
  const where = buildWhere(sp)

  const [facturas, total, agregados, proformasCount, porEstado] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
    }),
    prisma.factura.count({ where }),
    prisma.factura.aggregate({
      where: { tipo: 'ingreso', estado: { not: 'anulada' } },
      _sum: { total: true, montoPagado: true },
    }),
    prisma.factura.count({ where: { tipo: 'ingreso', esProforma: true, estado: { not: 'anulada' } } }),
    prisma.factura.groupBy({
      by: ['estado'],
      where: { tipo: 'ingreso' },
      _count: { _all: true },
    }),
  ])

  const totalFacturado = agregados._sum.total ?? 0
  const totalCobrado = agregados._sum.montoPagado ?? 0
  const resumen = {
    totalFacturado,
    totalCobrado,
    porCobrar: totalFacturado - totalCobrado,
    proformas: proformasCount,
  }
  const conteos = Object.fromEntries(porEstado.map(e => [e.estado, e._count._all])) as Record<string, number>
  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-muted-foreground" /> Cobros
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Facturas emitidas a clientes (cobros). Para gastos de proveedores ve a <Link href="/contabilidad" className="text-primary hover:underline">Contabilidad</Link>.
          </p>
        </div>
        <Link href="/contabilidad/facturas/nueva?tipo=ingreso">
          <Button>
            <Plus className="w-4 h-4" /> Nueva factura
          </Button>
        </Link>
      </div>

      {/* Cards resumen */}
      <FacturacionClient
        facturas={facturas.map(f => ({
          id: f.id,
          numero: f.numero,
          ncf: f.ncf,
          fecha: f.fecha.toISOString(),
          fechaVencimiento: f.fechaVencimiento?.toISOString() ?? null,
          total: f.total,
          montoPagado: f.montoPagado,
          estado: f.estado,
          esProforma: !!f.esProforma,
          cliente: f.cliente ? { id: f.cliente.id, nombre: f.cliente.nombre } : null,
          proyecto: f.proyecto ? { id: f.proyecto.id, nombre: f.proyecto.nombre, codigo: f.proyecto.codigo } : null,
          descripcion: f.descripcion,
        }))}
        resumen={resumen}
        filtros={{ estado: sp.estado ?? '', q: sp.q ?? '', desde: sp.desde ?? '', hasta: sp.hasta ?? '' }}
        conteos={conteos}
        paginacion={{ page, totalPages, total }}
      />
    </div>
  )
}
