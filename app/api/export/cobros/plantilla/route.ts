import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

/**
 * GET /api/export/cobros/plantilla
 *
 * Exporta las facturas de ingreso con saldo pendiente (estado ≠ pagada/anulada)
 * en el MISMO formato que la importación de pagos. El usuario llena las columnas
 * de pago (fecha_pago, monto_pago, …) y vuelve a importar el archivo.
 */
export const GET = withPermiso('contabilidad', 'ver', async (_req: NextRequest) => {
  const facturas = await prisma.factura.findMany({
    where: { tipo: 'ingreso', estado: { notIn: ['pagada', 'anulada'] } },
    select: {
      id: true, numero: true, ncf: true, total: true, montoPagado: true,
      cliente: { select: { nombre: true } },
      proyecto: { select: { nombre: true } },
    },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  })

  const headers = [
    'factura_id', 'numero', 'ncf', 'cliente', 'proyecto', 'total', 'ya_cobrado', 'saldo_pendiente',
    'fecha_pago', 'monto_pago', 'metodo_pago', 'cuenta_banco', 'referencia', 'observaciones',
  ]
  const filas = facturas.map(f => [
    f.id, f.numero, f.ncf ?? '', f.cliente?.nombre ?? '', f.proyecto?.nombre ?? '',
    f.total, f.montoPagado, Number((f.total - f.montoPagado).toFixed(2)),
    '', '', '', '', '', '',   // columnas a llenar
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...filas])
  ws['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 22 },
    { wch: 13 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 28 },
  ]
  ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1' }
  ws['!views'] = [{ ySplit: 1 }]

  const instr = [
    ['INSTRUCCIONES — IMPORTAR LOTE DE PAGOS (COBROS)'],
    [''],
    ['Llena las columnas de pago en las facturas que vas a cobrar y vuelve a importar este archivo.'],
    [''],
    ['NO MODIFIQUES'],
    ['factura_id', 'Identifica la factura. No lo borres ni lo cambies (es la llave del emparejamiento).'],
    ['numero / cliente / total …', 'Solo informativos. Si borras factura_id, se empareja por numero.'],
    [''],
    ['COLUMNAS A LLENAR'],
    ['monto_pago', 'Numérico > 0. No puede exceder el saldo_pendiente. Obligatorio para registrar el pago.'],
    ['fecha_pago', 'YYYY-MM-DD o DD/MM/YYYY. Si la dejas vacía, se usa la fecha de hoy.'],
    ['metodo_pago', 'Efectivo, Transferencia, Cheque, Tarjeta. Default: Transferencia.'],
    ['cuenta_banco', 'Nombre exacto de una cuenta bancaria activa. Si la pones, se crea el movimiento bancario.'],
    ['referencia', 'Nº de cheque / referencia de transferencia. Opcional.'],
    ['observaciones', 'Notas. Opcional.'],
    [''],
    ['NOTAS'],
    ['1.', 'Filas sin monto_pago se ignoran (no generan pago).'],
    ['2.', 'Puedes poner varias filas para la misma factura (varios abonos); la suma no puede exceder el saldo.'],
    ['3.', 'Antes de confirmar verás un preview con cada fila marcada OK o con error.'],
    ['4.', 'Las filas con error se omiten; se registran solo las válidas.'],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instr)
  ws2['!cols'] = [{ wch: 26 }, { wch: 78 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cobros')
  XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla-cobros-${fecha}.xlsx"`,
    },
  })
})
