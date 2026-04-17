import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('gastos', 'ver', async (_req: NextRequest) => {
  const headers = [
    'fecha', 'tipoGasto', 'referencia', 'descripcion', 'suplidor',
    'categoria', 'subcategoria', 'monto', 'moneda', 'metodoPago',
    'cuentaOrigen', 'observaciones', 'estado',
  ]

  const ejemplos = [
    ['2026-03-15', 'Compra de materiales', 'FAC-001', 'Compra de cemento Portland 50 sacos', 'Ferretería El Toro',
      'Materiales', 'Cemento', '12500.00', 'RD$', 'Transferencia', 'Cuenta Principal', '', 'Registrado'],
    ['2026-03-16', 'Mano de obra', 'REC-042', 'Pago de albañiles semana 1', 'Equipo González',
      'Mano de Obra', 'Albañilería', '28000.00', 'RD$', 'Efectivo', 'Caja Obra', 'Incluye bono', 'Revisado'],
    ['2026-03-17', 'Transporte', 'TRF-007', 'Flete de materiales desde el almacén', 'Transporte Rápido SRL',
      'Logística', 'Flete', '3500.00', 'RD$', 'Efectivo', '', '', 'Registrado'],
  ]

  const csvRows = [
    headers.join(','),
    ...ejemplos.map(row => row.map(v => `"${v}"`).join(',')),
  ]

  const csvContent = csvRows.join('\r\n')

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-gastos.csv"',
    },
  })
})
