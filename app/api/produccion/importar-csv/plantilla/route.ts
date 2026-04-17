import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'

/**
 * GET /api/produccion/importar-csv/plantilla?formato=csv|xlsx
 *
 * Descarga una plantilla con el formato esperado por el importador de
 * despiece. Incluye encabezados, filas de ejemplo y (en XLSX) una hoja
 * de instrucciones.
 */

// Columnas en el orden sugerido. Los nombres coinciden con los que
// reconoce el parser en lib/produccion-csv.ts.
const COLUMNAS = [
  'No.',
  'Designación',
  'Cantidad',
  'Longitud',
  'Anchura',
  'Grosor',
  'Tipo de material',
  'Nombre del material',
  'Longitud del borde 1',
  'Longitud del borde 2',
  'Ancho del borde 1',
  'Ancho del borde 2',
] as const

// Filas de ejemplo realistas (despiece típico de un mueble de cocina)
const EJEMPLOS: Array<Record<(typeof COLUMNAS)[number], string>> = [
  {
    'No.': 'A',
    'Designación': 'B60_2P-pu',
    'Cantidad': '2',
    'Longitud': '797 mm',
    'Anchura': '347 mm',
    'Grosor': '18 mm',
    'Tipo de material': 'Tablero',
    'Nombre del material': 'Mel_Blanco_Medio',
    'Longitud del borde 1': 'Canto_Blanco_MED (1 mm x 19 mm)',
    'Longitud del borde 2': 'Canto_Blanco_MED (1 mm x 19 mm)',
    'Ancho del borde 1': 'Canto_Blanco_MED (1 mm x 19 mm)',
    'Ancho del borde 2': 'Canto_Blanco_MED (1 mm x 19 mm)',
  },
  {
    'No.': 'B',
    'Designación': 'D60_2P-pu',
    'Cantidad': '2',
    'Longitud': '1986 mm',
    'Anchura': '297 mm',
    'Grosor': '18 mm',
    'Tipo de material': 'Tablero',
    'Nombre del material': 'Gris Coco Finsa',
    'Longitud del borde 1': 'Canto Gris Coco Finsa (1 mm x 19 mm)',
    'Longitud del borde 2': 'Canto Gris Coco Finsa (1 mm x 19 mm)',
    'Ancho del borde 1': 'Canto Gris Coco Finsa (1 mm x 19 mm)',
    'Ancho del borde 2': 'Canto Gris Coco Finsa (1 mm x 19 mm)',
  },
  {
    'No.': 'C',
    'Designación': 'TOPE-FINTOP',
    'Cantidad': '1',
    'Longitud': '2237 mm',
    'Anchura': '718 mm',
    'Grosor': '30 mm',
    'Tipo de material': 'Tablero',
    'Nombre del material': 'FINTOP',
    'Longitud del borde 1': 'Canto FINTOP (1 mm x 33 mm)',
    'Longitud del borde 2': 'Canto FINTOP (1 mm x 33 mm)',
    'Ancho del borde 1': 'Canto FINTOP (1 mm x 33 mm)',
    'Ancho del borde 2': 'Canto FINTOP (1 mm x 33 mm)',
  },
  {
    'No.': 'D',
    'Designación': 'D60_2P-fon',
    'Cantidad': '1',
    'Longitud': '1983 mm',
    'Anchura': '576 mm',
    'Grosor': '6 mm',
    'Tipo de material': 'Tablero',
    'Nombre del material': 'Mel_Blanco_Medio',
    'Longitud del borde 1': '',
    'Longitud del borde 2': '',
    'Ancho del borde 1': '',
    'Ancho del borde 2': '',
  },
]

// Instrucciones incluidas en la hoja auxiliar del XLSX
const INSTRUCCIONES: Array<[string, string]> = [
  ['Columna', 'Descripción'],
  ['No.', 'Letra o código de posición (ej: A, B, C). Opcional.'],
  ['Designación', 'Nombre interno de la pieza (ej: D60_2P-pu, TOPE-FINTOP). OBLIGATORIO.'],
  ['Cantidad', 'Número de piezas iguales. OBLIGATORIO (mínimo 1).'],
  ['Longitud', 'Longitud final de la pieza. Acepta "1986 mm" o solo "1986".'],
  ['Anchura', 'Anchura final en mm.'],
  ['Grosor', 'Espesor final en mm (ej: 18 para tablero estándar, 6 para fondo, 30 para tope).'],
  ['Tipo de material', 'Ej: Tablero, Canto, Herraje. Opcional pero recomendado.'],
  ['Nombre del material', 'Color / nombre comercial del material (ej: "Gris Coco Finsa", "Mel_Blanco_Medio").'],
  ['Longitud del borde 1', 'Descripción del canto en el lado largo 1 (opcional).'],
  ['Longitud del borde 2', 'Canto en el lado largo 2 (opcional).'],
  ['Ancho del borde 1', 'Canto en el lado corto 1 (opcional).'],
  ['Ancho del borde 2', 'Canto en el lado corto 2 (opcional).'],
  ['', ''],
  ['Notas', ''],
  ['• El separador esperado es ";" (punto y coma) para CSV, típico de Excel en ES.', ''],
  ['• Las unidades se detectan automáticamente: "1986 mm" y "1986" son equivalentes.', ''],
  ['• Si todos los cantos son iguales, se agruparán con "× 4" en el detalle.', ''],
  ['• Este formato es compatible con exportaciones de OptiNest, CutRite y similares.', ''],
]

export const GET = withPermiso('produccion', 'ver', async (req: NextRequest) => {
  const formato = req.nextUrl.searchParams.get('formato') ?? 'xlsx'

  if (formato === 'csv') {
    const rows = [COLUMNAS.join(';'), ...EJEMPLOS.map(e => COLUMNAS.map(c => `"${e[c]}"`).join(';'))]
    const csv = '\uFEFF' + rows.join('\r\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plantilla-despiece-produccion.csv"',
      },
    })
  }

  // XLSX con 2 hojas: Piezas (con encabezados y ejemplos) + Instrucciones
  const wb = XLSX.utils.book_new()

  const dataRows = EJEMPLOS.map(e => COLUMNAS.map(c => e[c]))
  const wsData: (string | number)[][] = [COLUMNAS as unknown as string[], ...dataRows]
  const wsPiezas = XLSX.utils.aoa_to_sheet(wsData)
  // Ancho razonable por columna
  wsPiezas['!cols'] = [
    { wch: 6 },   // No.
    { wch: 20 },  // Designación
    { wch: 10 },  // Cantidad
    { wch: 12 },  // Longitud
    { wch: 12 },  // Anchura
    { wch: 10 },  // Grosor
    { wch: 16 },  // Tipo de material
    { wch: 24 },  // Nombre del material
    { wch: 30 },  // Canto 1
    { wch: 30 },  // Canto 2
    { wch: 30 },  // Canto 3
    { wch: 30 },  // Canto 4
  ]
  XLSX.utils.book_append_sheet(wb, wsPiezas, 'Piezas')

  const wsInst = XLSX.utils.aoa_to_sheet(INSTRUCCIONES)
  wsInst['!cols'] = [{ wch: 28 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-despiece-produccion.xlsx"',
    },
  })
})
