// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedTitulo {
  nombre: string
  orden: number
}

export interface ParsedCapitulo {
  nombre: string
  tituloIdx: number | null
  orden: number
}

export interface ParsedPartida {
  capituloIdx: number
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  observaciones: string
  orden: number
}

export interface RowError {
  fila: number
  mensaje: string
}

export interface ParseResult {
  titulos: ParsedTitulo[]
  capitulos: ParsedCapitulo[]
  partidas: ParsedPartida[]
  errors: RowError[]
  totalRows: number
  validRows: number
}

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
  // accept comma as decimal separator too
  const cleaned = s.replace(/,/g, '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseExcelRows(rawRows: Record<string, unknown>[]): ParseResult {
  const titulos: ParsedTitulo[] = []
  const capitulos: ParsedCapitulo[] = []
  const partidas: ParsedPartida[] = []
  const errors: RowError[] = []

  // Maps to avoid duplicates
  const tituloMap = new Map<string, number>()   // tituloNombre → idx
  const capMap    = new Map<string, number>()   // `titulo||capitulo` → idx

  let tituloOrden = 0
  let totalRows   = 0
  let validRows   = 0

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const row = normalizeRow(raw)
    const fila = i + 2 // +1 header, +1 one-indexed

    // Skip fully empty rows
    if (Object.values(row).every(v => v === '')) continue
    totalRows++

    // ── Required: descripcion ──
    const descripcion = pick(row, 'descripcion', 'description', 'descripcion_partida', 'desc')
    if (!descripcion) {
      errors.push({ fila, mensaje: 'Falta la descripción de la partida (columna "descripcion")' })
      continue
    }

    // ── Required: cantidad ──
    const cantidadRaw = pick(row, 'cantidad', 'qty', 'quantity', 'cant')
    const cantidad = parseNum(cantidadRaw)
    if (cantidad === null || cantidad < 0) {
      errors.push({ fila, mensaje: `Cantidad inválida: "${cantidadRaw || '(vacío)'}" — debe ser un número >= 0` })
      continue
    }

    // ── Required: precio_unitario ──
    const precioRaw = pick(row, 'precio_unitario', 'precio', 'price', 'pu', 'precio_unit', 'p_unitario')
    const precioUnitario = parseNum(precioRaw)
    if (precioUnitario === null || precioUnitario < 0) {
      errors.push({ fila, mensaje: `Precio unitario inválido: "${precioRaw || '(vacío)'}" — debe ser un número >= 0` })
      continue
    }

    // ── Título ──
    const tituloNombre = pick(row, 'titulo', 'title', 'titulo_nombre', 'seccion', 'section')
    let tituloIdx: number | null = null
    if (tituloNombre) {
      if (!tituloMap.has(tituloNombre)) {
        const ordenTitulo = parseNum(pick(row, 'orden_titulo', 'orden_title')) ?? tituloOrden
        titulos.push({ nombre: tituloNombre, orden: Math.round(ordenTitulo) })
        tituloMap.set(tituloNombre, titulos.length - 1)
        tituloOrden++
      }
      tituloIdx = tituloMap.get(tituloNombre)!
    }

    // ── Capítulo ──
    const capituloNombre = pick(row, 'capitulo', 'chapter', 'capitulo_nombre', 'cap') || 'General'
    const capKey = `${tituloNombre}||${capituloNombre}`
    if (!capMap.has(capKey)) {
      const ordenCap = parseNum(pick(row, 'orden_capitulo', 'orden_cap')) ?? capitulos.length
      capitulos.push({ nombre: capituloNombre, tituloIdx, orden: Math.round(ordenCap) })
      capMap.set(capKey, capitulos.length - 1)
    }
    const capituloIdx = capMap.get(capKey)!

    // ── Partida ──
    const unidad      = pick(row, 'unidad', 'unit', 'ud', 'und') || 'gl'
    const codigo      = pick(row, 'codigo', 'code', 'cod')
    const observaciones = pick(row, 'observaciones', 'obs', 'notes', 'notas')
    const ordenPartida = parseNum(pick(row, 'orden_partida', 'orden_part')) ??
      partidas.filter(p => p.capituloIdx === capituloIdx).length

    partidas.push({
      capituloIdx,
      codigo,
      descripcion,
      unidad,
      cantidad,
      precioUnitario,
      subtotal: cantidad * precioUnitario,
      observaciones,
      orden: Math.round(ordenPartida),
    })
    validRows++
  }

  return { titulos, capitulos, partidas, errors, totalRows, validRows }
}
