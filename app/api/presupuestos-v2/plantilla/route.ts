import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// GET /api/presupuestos-v2/plantilla
// Returns a downloadable .xlsx template for bulk import
export async function GET() {
  // ── Sheet 1: Presupuesto (data template) ──────────────────────────────────
  const headers = [
    'titulo',
    'capitulo',
    'codigo',
    'descripcion',
    'unidad',
    'cantidad',
    'precio_unitario',
    'observaciones',
  ]

  const sampleRows = [
    // Título 1, Capítulo A
    ['Obras Civiles', 'Movimiento de tierra', 'MT-001', 'Limpieza y descapote del terreno', 'm2', 500, 120.5, ''],
    ['Obras Civiles', 'Movimiento de tierra', 'MT-002', 'Excavación manual', 'm3', 80, 350, 'Suelo blando'],
    ['Obras Civiles', 'Movimiento de tierra', 'MT-003', 'Relleno compactado', 'm3', 60, 280, ''],
    // Título 1, Capítulo B
    ['Obras Civiles', 'Cimentaciones', 'CI-001', 'Hormigón en zapatas f\'c=210 kg/cm2', 'm3', 12.5, 4800, ''],
    ['Obras Civiles', 'Cimentaciones', 'CI-002', 'Acero de refuerzo en zapatas', 'kg', 850, 85, ''],
    // Título 2, Capítulo A
    ['Estructura', 'Columnas y vigas', 'EV-001', 'Hormigón en columnas f\'c=210 kg/cm2', 'm3', 8, 5200, ''],
    ['Estructura', 'Columnas y vigas', 'EV-002', 'Acero de refuerzo longitudinal', 'kg', 1200, 85, ''],
    // Sin título (capítulo suelto)
    ['', 'Varios', 'VA-001', 'Limpieza final de obra', 'gl', 1, 5000, 'Al finalizar todos los trabajos'],
  ]

  const wsData = [headers, ...sampleRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, // titulo
    { wch: 22 }, // capitulo
    { wch: 10 }, // codigo
    { wch: 45 }, // descripcion
    { wch: 8  }, // unidad
    { wch: 10 }, // cantidad
    { wch: 14 }, // precio_unitario
    { wch: 30 }, // observaciones
  ]

  // ── Sheet 2: Instrucciones ─────────────────────────────────────────────────
  const instrRows = [
    ['INSTRUCCIONES DE IMPORTACIÓN'],
    [''],
    ['COLUMNAS REQUERIDAS (obligatorias)'],
    ['descripcion', 'Nombre o descripción de la partida. No puede estar vacío.'],
    ['cantidad', 'Cantidad numérica >= 0. Se aceptan coma o punto como separador decimal (ej: 1,5 o 1.5).'],
    ['precio_unitario', 'Precio por unidad >= 0. Mismo formato que cantidad.'],
    [''],
    ['COLUMNAS OPCIONALES'],
    ['titulo', 'Agrupa capítulos bajo un título (sección de nivel superior). Dejar vacío si no aplica.'],
    ['capitulo', 'Capítulo al que pertenece la partida. Si se omite, se asigna a "General".'],
    ['codigo', 'Código interno de la partida (ej: MT-001). Puede quedar vacío.'],
    ['unidad', 'Unidad de medida (ej: m2, m3, kg, gl, hr). Por defecto: "gl".'],
    ['observaciones', 'Notas adicionales sobre la partida. Puede quedar vacío.'],
    [''],
    ['NOMBRES ALTERNATIVOS ACEPTADOS'],
    ['titulo', 'title / titulo_nombre / seccion / section'],
    ['capitulo', 'chapter / capitulo_nombre / cap'],
    ['descripcion', 'description / descripcion_partida / desc'],
    ['cantidad', 'qty / quantity / cant'],
    ['precio_unitario', 'precio / price / pu / precio_unit / p_unitario'],
    ['unidad', 'unit / ud / und'],
    ['observaciones', 'obs / notes / notas'],
    [''],
    ['NOTAS IMPORTANTES'],
    ['1.', 'No modifiques los nombres de las columnas si usas los nombres exactos de esta plantilla.'],
    ['2.', 'Puedes reordenar las filas; el orden de aparición determina el orden en el presupuesto.'],
    ['3.', 'Las filas completamente vacías se ignoran automáticamente.'],
    ['4.', 'Si un título o capítulo se repite en varias filas, se agrupa automáticamente.'],
    ['5.', 'El subtotal se calcula como cantidad × precio_unitario (no es necesario incluirlo).'],
    ['6.', 'Los errores por fila se muestran en la pantalla de previsualización antes de importar.'],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr['!cols'] = [{ wch: 22 }, { wch: 70 }]

  // ── Workbook ───────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto')
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-presupuesto.xlsx"',
    },
  })
}
