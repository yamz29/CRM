import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// GET /api/recursos/plantilla
export async function GET() {
  const headers = [
    'codigo', 'nombre', 'tipo', 'categoria', 'subcategoria',
    'unidad', 'costo_unitario', 'moneda', 'proveedor', 'marca', 'observaciones', 'activo',
  ]

  const sampleRows = [
    ['CEM-001',     'Cemento Portland 50kg',      'materiales',  'Mampostería', '',        'saco',  550.00,  'DOP', 'Cemex',     'Melón',  '',                  'si'],
    ['ARE-001',     'Arena lavada fina',           'materiales',  'Mampostería', '',        'm3',    1800.00, 'DOP', '',          '',       '',                  'si'],
    ['BLO-006',     'Block 6 pulgadas',            'materiales',  'Mampostería', '',        'ud',    52.50,   'DOP', 'Argos',     '',       '12x20x40cm',        'si'],
    ['MEL-RH18-BL', 'Melamina RH 18mm Blanca',    'materiales',  'Melamina',    '18mm',    'pl',    1850.00, 'DOP', 'Maderería', 'Arauco', 'Plancha 244x122cm', 'si'],
    ['HER-BIS35',   'Bisagra 35mm a presión',      'herrajes',    'Melamina',    '',        'ud',    120.00,  'DOP', '',          'Grass',  '',                  'si'],
    ['TOR-CON',     'Tornillo confirmat 7x50mm',   'consumibles', 'Melamina',    '',        'ud',    8.50,    'DOP', '',          '',       '',                  'si'],
    ['MO-TALLER',   'Mano de obra taller',         'manoObra',    'Carpintería', '',        'día',   3500.00, 'DOP', '',          '',       '',                  'si'],
    ['REC-E001',    'Mezcladora de concreto',       'equipos',     'Hormigón',    '',        'día',   4500.00, 'DOP', 'Alquimaq', '',       'Alquiler diario',   'si'],
  ]

  const wsData = [headers, ...sampleRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 14 }, // codigo
    { wch: 30 }, // nombre
    { wch: 14 }, // tipo
    { wch: 18 }, // categoria
    { wch: 14 }, // subcategoria
    { wch: 8  }, // unidad
    { wch: 14 }, // costo_unitario
    { wch: 8  }, // moneda
    { wch: 18 }, // proveedor
    { wch: 12 }, // marca
    { wch: 28 }, // observaciones
    { wch: 8  }, // activo
  ]

  const instrRows = [
    ['INSTRUCCIONES — IMPORTAR RECURSOS'],
    [''],
    ['COLUMNA REQUERIDA'],
    ['nombre', 'Nombre del recurso. No puede estar vacío.'],
    [''],
    ['COLUMNAS OPCIONALES'],
    ['codigo',        'Código interno (ej: CEM-001). Si ya existe ese código, el recurso se ACTUALIZA en vez de crearse uno nuevo.'],
    ['tipo',          'Tipo de recurso. Ver valores válidos abajo. Por defecto: materiales.'],
    ['categoria',     'Categoría libre (ej: Mampostería, Melamina, Carpintería).'],
    ['subcategoria',  'Subcategoría libre.'],
    ['unidad',        'Unidad de medida (ej: saco, m2, hr, ud, pl). Por defecto: ud.'],
    ['costo_unitario','Costo por unidad en RD$. Solo número, sin símbolos. Por defecto: 0.'],
    ['moneda',        'Moneda (DOP, USD). Por defecto: DOP.'],
    ['proveedor',     'Nombre del proveedor.'],
    ['marca',         'Marca o fabricante.'],
    ['observaciones', 'Notas adicionales.'],
    ['activo',        'Si el recurso está activo: si / no. Por defecto: si.'],
    [''],
    ['TIPOS VÁLIDOS'],
    ['materiales',   'Materiales de construcción y acabados'],
    ['manoObra',     'Mano de obra (también se acepta: mano de obra, mano_obra)'],
    ['equipos',      'Equipos y maquinaria'],
    ['herramientas', 'Herramientas'],
    ['subcontratos', 'Subcontratos'],
    ['transportes',  'Transportes y fletes'],
    ['herrajes',     'Herrajes y ferretería'],
    ['consumibles',  'Consumibles varios'],
    [''],
    ['LÓGICA DE IMPORTACIÓN'],
    ['Crear + Actualizar', 'Si el código ya existe → actualiza el recurso. Si no existe → crea uno nuevo.'],
    ['Solo crear',         'Solo crea recursos nuevos. Si el código ya existe, la fila se omite.'],
    ['Solo actualizar',    'Solo actualiza recursos existentes por código. Si no existe, la fila se omite.'],
    [''],
    ['HISTÓRICO DE PRECIOS'],
    ['', 'Cada vez que el costo_unitario cambia (por importación o edición manual), el sistema'],
    ['', 'guarda automáticamente un registro del precio anterior y el nuevo, con fecha y origen.'],
    [''],
    ['NOTAS'],
    ['1.', 'Las filas completamente vacías se ignoran.'],
    ['2.', 'Se aceptan coma o punto como separador decimal en costo_unitario.'],
    ['3.', 'Los errores se muestran en la pantalla de vista previa antes de confirmar.'],
    ['4.', 'El histórico de precios no afecta APUs ni presupuestos ya guardados.'],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows)
  wsInstr['!cols'] = [{ wch: 20 }, { wch: 72 }]

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
