import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// GET /api/recursos/plantilla
// Devuelve una plantilla .xlsx para importación masiva de recursos
export async function GET() {
  const headers = ['codigo', 'nombre', 'tipo', 'categoria', 'subcategoria', 'unidad', 'costo_unitario', 'proveedor', 'marca', 'observaciones']

  const sampleRows = [
    ['REC-M001', 'Cemento Portland 50kg',   'materiales',   'Mampostería',  '',       'saco',  550,   'Cemex',       'Melón',  ''],
    ['REC-M002', 'Arena lavada fina',        'materiales',   'Mampostería',  '',       'm3',    1800,  '',            '',       ''],
    ['REC-MO01', 'Oficial albañil',          'manoObra',     'Albañilería',  '',       'día',   3500,  '',            '',       ''],
    ['REC-E001', 'Mezcladora de concreto',   'equipos',      'Hormigón',     '',       'día',   4500,  'Alquimaq',    '',       'Alquiler diario'],
    ['REC-H001', 'Bisagra 35mm a presión',   'herrajes',     'Melamina',     '',       'ud',    120,   '',            'Grass',  ''],
    ['REC-T001', 'Flete materiales',         'transportes',  'General',      '',       'viaje', 2500,  '',            '',       ''],
  ]

  const wsData = [headers, ...sampleRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 12 }, // codigo
    { wch: 30 }, // nombre
    { wch: 14 }, // tipo
    { wch: 18 }, // categoria
    { wch: 14 }, // subcategoria
    { wch: 8  }, // unidad
    { wch: 14 }, // costo_unitario
    { wch: 18 }, // proveedor
    { wch: 12 }, // marca
    { wch: 25 }, // observaciones
  ]

  const instrRows = [
    ['INSTRUCCIONES — IMPORTAR RECURSOS'],
    [''],
    ['COLUMNA REQUERIDA'],
    ['nombre', 'Nombre del recurso. No puede estar vacío.'],
    [''],
    ['COLUMNAS OPCIONALES'],
    ['codigo',         'Código interno (ej: REC-M001). Si ya existe ese código, se omite sin crear duplicado.'],
    ['tipo',           'Tipo de recurso. Ver valores válidos abajo. Por defecto: materiales.'],
    ['categoria',      'Categoría libre (ej: Mampostería, Melamina).'],
    ['subcategoria',   'Subcategoría libre.'],
    ['unidad',         'Unidad de medida (ej: saco, m2, hr, ud). Por defecto: ud.'],
    ['costo_unitario', 'Costo por unidad. Solo número. Por defecto: 0.'],
    ['proveedor',      'Nombre del proveedor.'],
    ['marca',          'Marca o fabricante.'],
    ['observaciones',  'Notas adicionales.'],
    [''],
    ['TIPOS VÁLIDOS'],
    ['materiales',   'Materiales de construcción'],
    ['manoObra',     'Mano de obra (también se acepta: mano de obra, mano_obra)'],
    ['equipos',      'Equipos y maquinaria'],
    ['herramientas', 'Herramientas'],
    ['subcontratos', 'Subcontratos'],
    ['transportes',  'Transportes y fletes'],
    ['herrajes',     'Herrajes y ferretería'],
    ['consumibles',  'Consumibles varios'],
    [''],
    ['NOTAS'],
    ['1.', 'Las filas completamente vacías se ignoran.'],
    ['2.', 'Si el código ya existe en el sistema, esa fila se omite sin crear duplicado.'],
    ['3.', 'Los errores se muestran en la pantalla de vista previa antes de confirmar.'],
    ['4.', 'Se aceptan coma o punto como separador decimal en costo_unitario.'],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr['!cols'] = [{ wch: 16 }, { wch: 65 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Recursos')
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-recursos.xlsx"',
    },
  })
}
