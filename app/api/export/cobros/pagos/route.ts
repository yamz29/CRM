import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

/**
 * GET /api/export/cobros/pagos
 *
 * Exporta el historial de pagos (PagoFactura) de facturas de ingreso como
 * reporte. Respeta filtros de la página de Cobros: q, desde, hasta
 * (por fecha de pago).
 */
export const GET = withPermiso('contabilidad', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const where: Record<string, unknown> = { factura: { tipo: 'ingreso' } }
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde + 'T00:00:00') } : {}),
      ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
    }
  }
  if (q) {
    where.factura = {
      tipo: 'ingreso',
      OR: [
        { numero: { contains: q } },
        { ncf: { contains: q } },
        { cliente: { nombre: { contains: q } } },
        { proyecto: { nombre: { contains: q } } },
      ],
    }
  }

  const pagos = await prisma.pagoFactura.findMany({
    where,
    include: {
      cuentaBancaria: { select: { nombre: true } },
      factura: {
        select: {
          numero: true, ncf: true,
          cliente: { select: { nombre: true } },
          proyecto: { select: { nombre: true } },
        },
      },
    },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
  })

  const rows = pagos.map(p => ({
    'Fecha':      p.fecha.toISOString().slice(0, 10),
    'Factura':    p.factura.numero,
    'NCF':        p.factura.ncf ?? '',
    'Cliente':    p.factura.cliente?.nombre ?? '',
    'Proyecto':   p.factura.proyecto?.nombre ?? '',
    'Monto':      p.monto,
    'Método':     p.metodoPago,
    'Cuenta':     p.cuentaBancaria?.nombre ?? '',
    'Referencia': p.referencia ?? '',
    'Observaciones': p.observaciones ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 22 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 28 },
  ]
  // Fila de total
  const total = pagos.reduce((s, p) => s + p.monto, 0)
  XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', 'TOTAL', total]], { origin: -1 })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="historial-cobros-${fecha}.xlsx"`,
    },
  })
})
