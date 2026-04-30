import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { FacturacionClient } from './FacturacionClient'
import { Button } from '@/components/ui/button'
import { Plus, FileText } from 'lucide-react'

/**
 * /facturacion — vista enfocada en EMISIÓN de facturas a clientes (ingresos).
 *
 * Distinta a /contabilidad/facturas que mezcla ingresos + egresos. Aquí solo
 * vemos lo que YO emito (cobranza). Para registrar facturas de proveedores
 * el usuario va a Contabilidad.
 *
 * Permiso: 'contabilidad' (mismo que el resto del módulo financiero).
 */
export default async function FacturacionPage() {
  const facturas = await prisma.factura.findMany({
    where: { tipo: 'ingreso' },
    include: {
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true, codigo: true } },
    },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: 200,
  })

  // Resumen para los cards superiores
  const totalFacturado = facturas
    .filter(f => f.estado !== 'anulada')
    .reduce((s, f) => s + f.total, 0)
  const totalCobrado = facturas
    .filter(f => f.estado !== 'anulada')
    .reduce((s, f) => s + f.montoPagado, 0)
  const porCobrar = totalFacturado - totalCobrado
  const proformas = facturas.filter(f => f.esProforma && f.estado !== 'anulada').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-muted-foreground" /> Facturación
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
        resumen={{ totalFacturado, totalCobrado, porCobrar, proformas }}
      />
    </div>
  )
}
