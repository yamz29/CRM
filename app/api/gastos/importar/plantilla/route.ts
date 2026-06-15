import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import * as XLSX from 'xlsx'

/**
 * GET /api/gastos/importar/plantilla
 *
 * Devuelve un .xlsx con dos hojas:
 *   1) "Gastos" — con headers + 3 filas de ejemplo (anchos optimizados)
 *   2) "Instrucciones" — qué columnas son obligatorias, formato, nombres alternativos aceptados
 *
 * Permiso: gastos.ver (cualquiera con permiso al módulo descarga la plantilla).
 */
export const GET = withPermiso('gastos', 'ver', async (_req: NextRequest) => {
  const headers = [
    'fecha', 'descripcion', 'monto', 'proveedor', 'categoria',
    'subcategoria', 'metodo_pago', 'referencia', 'proyecto_codigo',
    'destino_tipo', 'observaciones',
  ]

  const ejemplos = [
    ['2026-03-15', 'Compra cemento Portland 50 sacos', 12500, 'Ferretería El Toro',
      'Materiales', 'Cemento', 'Transferencia', 'FAC-001', 'R-0042', 'proyecto', ''],
    ['2026-03-16', 'Mano de obra albañilería semana 1', 28000, 'Equipo González',
      'Mano de Obra', 'Albañilería', 'Efectivo', 'REC-042', 'R-0042', 'proyecto', 'Incluye bono producción'],
    ['2026-03-17', 'Recarga papelería oficina', 1850, 'Office Depot',
      'Administración', 'Papelería', 'Tarjeta', 'TIK-2391', '', 'oficina', ''],
  ]

  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...ejemplos])
  ws1['!cols'] = [
    { wch: 12 }, // fecha
    { wch: 40 }, // descripcion
    { wch: 12 }, // monto
    { wch: 22 }, // proveedor
    { wch: 16 }, // categoria
    { wch: 16 }, // subcategoria
    { wch: 14 }, // metodo_pago
    { wch: 14 }, // referencia
    { wch: 14 }, // proyecto_codigo
    { wch: 12 }, // destino_tipo
    { wch: 30 }, // observaciones
  ]
  ws1['!autofilter'] = { ref: ws1['!ref'] ?? 'A1' }
  ws1['!views'] = [{ ySplit: 1 }]

  const instrRows = [
    ['INSTRUCCIONES DE IMPORTACIÓN MASIVA DE GASTOS'],
    [''],
    ['COLUMNAS OBLIGATORIAS'],
    ['fecha', 'Formato YYYY-MM-DD (2026-03-15) o DD/MM/YYYY (15/03/2026).'],
    ['descripcion', 'Texto libre del gasto. No puede estar vacío.'],
    ['monto', 'Numérico >= 0. Acepta coma o punto decimal (1,250.50 o 1250.50).'],
    [''],
    ['COLUMNAS OPCIONALES'],
    ['proveedor', 'Nombre del proveedor o suplidor. Texto libre.'],
    ['categoria', 'Materiales, Mano de Obra, Logística, Administración, etc.'],
    ['subcategoria', 'Detalle de la categoría. Opcional.'],
    ['metodo_pago', 'Efectivo, Transferencia, Cheque, Tarjeta. Default: Efectivo.'],
    ['referencia', 'Nº de factura, recibo o documento. Texto libre.'],
    ['proyecto_codigo', 'Código del proyecto (R-0042) o el nombre exacto del proyecto. Si lo dejas vacío, queda sin proyecto.'],
    ['destino_tipo', 'proyecto | oficina | taller | general. Default: general (o proyecto si hay código).'],
    ['observaciones', 'Notas adicionales. Opcional.'],
    [''],
    ['NOMBRES ALTERNATIVOS ACEPTADOS'],
    ['descripcion', 'descripción / desc / concepto'],
    ['monto', 'valor / total / importe'],
    ['proveedor', 'suplidor / vendor'],
    ['categoria', 'categoría / category'],
    ['metodo_pago', 'metodoPago / método / forma de pago'],
    ['proyecto_codigo', 'proyecto / codigo_proyecto / cod_proyecto'],
    [''],
    ['NOTAS IMPORTANTES'],
    ['1.', 'Filas completamente vacías se ignoran.'],
    ['2.', 'proyecto_codigo acepta el código (R-0042) o el nombre exacto del proyecto. Si no coincide con ninguno, la fila queda como ERROR en el preview.'],
    ['3.', 'Antes de confirmar la importación verás un preview con cada fila marcada OK o con error.'],
    ['4.', 'Los gastos importados arrancan en estado "Registrado" — puedes cambiarlos después.'],
    ['5.', 'Los gastos NO se cobran ITBIS automáticamente — si lo necesitas, créalos como factura.'],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instrRows)
  ws2['!cols'] = [{ wch: 22 }, { wch: 70 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Gastos')
  XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-gastos.xlsx"',
    },
  })
})
