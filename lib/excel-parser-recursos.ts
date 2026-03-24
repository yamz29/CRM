// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedRecurso {
  codigo: string
  nombre: string
  tipo: string
  categoria: string
  subcategoria: string
  unidad: string
  costoUnitario: number
  moneda: string
  proveedor: string
  marca: string
  observaciones: string
  activo: boolean
}

export interface RecursoRowError {
  fila: number
  mensaje: string
}

export interface ParseRecursosResult {
  recursos: ParsedRecurso[]
  errors: RecursoRowError[]
  totalRows: number
  validRows: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPOS_VALIDOS = ['materiales', 'manoObra', 'equipos', 'herramientas', 'subcontratos', 'transportes', 'herrajes', 'consumibles']

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/[^a-z0-9_]/g, '')
}

function normalizeRow(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    const nk = normalizeKey(k)
    if (nk) result[nk] = String(v ?? '').trim()
  }
  return result
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k]
  }
  return ''
}

function parseNum(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/,/g, '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// Normalize tipo to internal values
function normalizeTipo(raw: string): string {
  const map: Record<string, string> = {
    'materiales': 'materiales',
    'material': 'materiales',
    'manoobra': 'manoObra',
    'mano_obra': 'manoObra',
    'mano de obra': 'manoObra',
    'mano obra': 'manoObra',
    'equipos': 'equipos',
    'equipo': 'equipos',
    'herramientas': 'herramientas',
    'herramienta': 'herramientas',
    'subcontratos': 'subcontratos',
    'subcontrato': 'subcontratos',
    'transportes': 'transportes',
    'transporte': 'transportes',
    'herrajes': 'herrajes',
    'herraje': 'herrajes',
    'consumibles': 'consumibles',
    'consumible': 'consumibles',
  }
  const normalized = raw.toLowerCase().trim()
  return map[normalized] || raw
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseRecursosRows(rawRows: Record<string, unknown>[]): ParseRecursosResult {
  const recursos: ParsedRecurso[] = []
  const errors: RecursoRowError[] = []
  let totalRows = 0
  let validRows = 0

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const row = normalizeRow(raw)
    const fila = i + 2 // +1 header, +1 one-indexed

    // Skip fully empty rows
    if (Object.values(row).every(v => v === '')) continue
    totalRows++

    // Required: nombre
    const nombre = pick(row, 'nombre', 'name', 'recurso', 'descripcion', 'description')
    if (!nombre) {
      errors.push({ fila, mensaje: 'Falta el nombre del recurso (columna "nombre")' })
      continue
    }

    // Optional: tipo — default materiales
    const tipoRaw = pick(row, 'tipo', 'type', 'categoria_tipo', 'tipo_recurso')
    const tipo = tipoRaw ? normalizeTipo(tipoRaw) : 'materiales'
    if (tipoRaw && !TIPOS_VALIDOS.includes(tipo)) {
      errors.push({ fila, mensaje: `Tipo inválido: "${tipoRaw}". Válidos: ${TIPOS_VALIDOS.join(', ')}` })
      continue
    }

    // Optional: costoUnitario
    const costoRaw = pick(row, 'costo_unitario', 'costo', 'costounitario', 'precio', 'price', 'cost')
    const costoUnitario = costoRaw ? (parseNum(costoRaw) ?? 0) : 0
    if (costoRaw && costoUnitario < 0) {
      errors.push({ fila, mensaje: `Costo inválido: "${costoRaw}" — debe ser >= 0` })
      continue
    }

    // Optional: moneda (default DOP)
    const monedaRaw = pick(row, 'moneda', 'currency', 'divisa')
    const moneda = monedaRaw ? monedaRaw.toUpperCase() : 'DOP'

    // Optional: activo (default true)
    const activoRaw = pick(row, 'activo', 'active', 'habilitado')
    const activo = activoRaw === ''
      ? true
      : ['1', 'si', 'sí', 'yes', 'true', 'activo', 'x'].includes(activoRaw.toLowerCase())

    recursos.push({
      codigo:       pick(row, 'codigo', 'code', 'cod', 'clave'),
      nombre,
      tipo,
      categoria:    pick(row, 'categoria', 'category', 'cat'),
      subcategoria: pick(row, 'subcategoria', 'subcategory', 'subcat'),
      unidad:       pick(row, 'unidad', 'unit', 'ud', 'und') || 'ud',
      costoUnitario,
      moneda,
      proveedor:    pick(row, 'proveedor', 'provider', 'supplier'),
      marca:        pick(row, 'marca', 'brand'),
      observaciones: pick(row, 'observaciones', 'obs', 'notes', 'notas'),
      activo,
    })
    validRows++
  }

  return { recursos, errors, totalRows, validRows }
}
