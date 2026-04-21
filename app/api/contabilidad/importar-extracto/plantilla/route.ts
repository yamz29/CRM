import { NextRequest, NextResponse } from 'next/server'
import { checkPermiso } from '@/lib/permisos'

// GET /api/contabilidad/importar-extracto/plantilla
// Descarga una plantilla CSV vacía para llenar manualmente.
// Columnas soportadas por el parser genérico:
//   fecha (YYYY-MM-DD o DD/MM/YYYY)
//   descripcion
//   referencia (opcional)
//   debito (monto si sale de la cuenta)
//   credito (monto si entra a la cuenta)
//
// Si prefieres una sola columna "monto" con tipo separado, también funciona,
// pero el patrón debito/credito es el más claro.
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const csv = [
    'fecha,descripcion,referencia,debito,credito',
    '2026-04-20,Pago factura proveedor XYZ,REF-12345,5000.00,',
    '2026-04-21,Transferencia recibida cliente ABC,REF-67890,,15000.00',
    '2026-04-22,Comisión bancaria,,150.00,',
    '2026-04-23,Depósito en efectivo,DEP-001,,20000.00',
  ].join('\n')

  // BOM UTF-8 para que Excel abra con encoding correcto y acentos salgan bien
  const content = '\ufeff' + csv

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="plantilla-extracto-bancario.csv"',
    },
  })
}
