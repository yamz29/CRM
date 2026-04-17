/**
 * Parser de CSV de despiece para órdenes de producción.
 *
 * Acepta el formato típico de exportación de software CAD/CNC (OptiNest,
 * CutRite, etc.) con columnas (ES con tildes o sin):
 *   - No. / Posición / Ref → letra/código de posición (ej: 'A', 'B')
 *   - Designación / Nombre → nombre de la pieza (ej: 'D60_2P-pu')
 *   - Cantidad → número de piezas
 *   - Longitud / Anchura / Grosor (o los 'crudos') → dimensiones en mm
 *   - Tipo de material → 'Tablero', 'Canto', etc.
 *   - Nombre del material → material/color (ej: 'Gris Coco Finsa')
 *   - Longitud del borde 1/2, Ancho del borde 1/2 → info de canteado
 *
 * Autodetecta separador `;` o `,` y limpia valores con comillas.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface CsvPiezaRaw {
  rowNumber: number            // 1-based, para reportar errores
  referencia: string | null
  nombre: string
  cantidad: number
  dimensiones: string | null   // "LxAxE mm" formateado
  tipo: string | null          // 'Tablero' | 'Canto' | etc.
  material: string | null      // color/descripción del material
  canteado: string | null      // texto libre con cantos
}

export interface CsvParseResult {
  items: CsvPiezaRaw[]
  errores: { fila: number; mensaje: string }[]
  totalFilas: number
  separador: ';' | ','
  // Resumen útil para preview
  resumenPorMaterial: { material: string; piezas: number; cantidad: number }[]
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Normaliza nombre de columna: minúsculas, sin tildes, sin espacios raros */
function normalizeHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Detecta el separador mirando la primera línea */
function detectSeparator(firstLine: string): ';' | ',' {
  const semis = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return semis >= commas ? ';' : ','
}

/**
 * Parse CSV respetando campos entre comillas con separador dentro.
 * Simplificación del estándar RFC 4180 suficiente para despieces típicos.
 */
function parseCsvLine(line: string, sep: ';' | ','): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      // Comilla escapada ("")
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (c === sep && !inQuote) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

/** Extrae un número de un string con unidades (ej: "1986 mm" → 1986) */
function parseNumber(s: string | undefined): number | null {
  if (!s) return null
  const cleaned = s.replace(/[^\d,.\-]/g, '').replace(',', '.')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** Quita el cero decimal (ej: "18.00" → "18") */
function fmtMm(n: number): string {
  return Math.round(n * 100) / 100 + ''
}

// ── Main parse function ─────────────────────────────────────────────────

export function parseCsvDespiece(csvText: string): CsvParseResult {
  // Normalizar saltos de línea y remover BOM
  const txt = csvText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const lines = txt.split('\n').filter(l => l.trim().length > 0)

  if (lines.length < 2) {
    return {
      items: [],
      errores: [{ fila: 0, mensaje: 'El archivo está vacío o no tiene filas de datos' }],
      totalFilas: 0,
      separador: ';',
      resumenPorMaterial: [],
    }
  }

  const sep = detectSeparator(lines[0])
  const headersRaw = parseCsvLine(lines[0], sep)
  const headers = headersRaw.map(normalizeHeader)

  // Mapa de nombres posibles → índice de columna
  function findCol(...candidates: string[]): number {
    for (const cand of candidates) {
      const normalized = normalizeHeader(cand)
      const idx = headers.indexOf(normalized)
      if (idx >= 0) return idx
    }
    return -1
  }

  const idx = {
    numero: findCol('no', 'no.', 'num', 'numero', 'posicion', 'ref', 'referencia'),
    designacion: findCol('designacion', 'nombre', 'descripcion corta', 'pieza'),
    cantidad: findCol('cantidad', 'cant', 'qty'),
    longitud: findCol('longitud', 'largo', 'length'),
    anchura: findCol('anchura', 'ancho', 'width'),
    grosor: findCol('grosor', 'espesor', 'thickness'),
    longitudCruda: findCol('longitud - cruda', 'longitud cruda'),
    anchuraCruda: findCol('ancho - crudo', 'ancho crudo', 'anchura - cruda'),
    grosorCrudo: findCol('espesor - crudo', 'espesor crudo', 'grosor crudo'),
    tipoMaterial: findCol('tipo de material', 'tipo material', 'tipo'),
    nombreMaterial: findCol('nombre del material', 'material', 'descripcion del material'),
    canto1: findCol('longitud del borde 1', 'canto 1', 'borde 1'),
    canto2: findCol('longitud del borde 2', 'canto 2', 'borde 2'),
    canto3: findCol('ancho del borde 1', 'canto 3', 'borde 3'),
    canto4: findCol('ancho de borde 2', 'ancho del borde 2', 'canto 4', 'borde 4'),
  }

  if (idx.designacion < 0) {
    return {
      items: [],
      errores: [{ fila: 1, mensaje: 'No se encontró columna "Designación" / "Nombre" en el encabezado' }],
      totalFilas: lines.length - 1,
      separador: sep,
      resumenPorMaterial: [],
    }
  }

  const items: CsvPiezaRaw[] = []
  const errores: { fila: number; mensaje: string }[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i], sep)
    const getCol = (i: number) => (i >= 0 && i < row.length ? row[i] : '')

    const designacion = getCol(idx.designacion).trim()
    if (!designacion) {
      errores.push({ fila: i + 1, mensaje: 'Designación vacía (fila omitida)' })
      continue
    }

    const cantidadNum = parseNumber(getCol(idx.cantidad))
    if (!cantidadNum || cantidadNum <= 0) {
      errores.push({ fila: i + 1, mensaje: `Cantidad inválida: "${getCol(idx.cantidad)}"` })
      continue
    }

    // Dimensiones finales; si no hay, usar las crudas
    const l = parseNumber(getCol(idx.longitud)) ?? parseNumber(getCol(idx.longitudCruda))
    const a = parseNumber(getCol(idx.anchura)) ?? parseNumber(getCol(idx.anchuraCruda))
    const g = parseNumber(getCol(idx.grosor)) ?? parseNumber(getCol(idx.grosorCrudo))
    const dims =
      l && a && g ? `${fmtMm(l)}×${fmtMm(a)}×${fmtMm(g)} mm`
      : l && a   ? `${fmtMm(l)}×${fmtMm(a)} mm`
      : null

    // Canteado: unir los 4 bordes en texto legible
    const cantos = [
      getCol(idx.canto1),
      getCol(idx.canto2),
      getCol(idx.canto3),
      getCol(idx.canto4),
    ]
      .map(c => c.trim().replace(/^"+|"+$/g, ''))
      .filter(c => c && c !== '""')
    // Agrupar cantos idénticos con contador
    let canteadoStr: string | null = null
    if (cantos.length > 0) {
      const counts = new Map<string, number>()
      for (const c of cantos) counts.set(c, (counts.get(c) ?? 0) + 1)
      canteadoStr = Array.from(counts.entries())
        .map(([c, n]) => n > 1 ? `${c} × ${n}` : c)
        .join('; ')
    }

    const tipo = getCol(idx.tipoMaterial).trim() || null
    const material = getCol(idx.nombreMaterial).trim() || null
    const referencia = getCol(idx.numero).trim() || null

    items.push({
      rowNumber: i + 1,
      referencia,
      nombre: designacion,
      cantidad: Math.max(1, Math.round(cantidadNum)),
      dimensiones: dims,
      tipo,
      material,
      canteado: canteadoStr,
    })
  }

  // Resumen por material (útil para preview)
  const resumenMap = new Map<string, { piezas: number; cantidad: number }>()
  for (const it of items) {
    const key = it.material || '(Sin material)'
    const cur = resumenMap.get(key) ?? { piezas: 0, cantidad: 0 }
    cur.piezas += 1
    cur.cantidad += it.cantidad
    resumenMap.set(key, cur)
  }
  const resumenPorMaterial = Array.from(resumenMap.entries())
    .map(([material, v]) => ({ material, ...v }))
    .sort((a, b) => b.cantidad - a.cantidad)

  return {
    items,
    errores,
    totalFilas: lines.length - 1,
    separador: sep,
    resumenPorMaterial,
  }
}
