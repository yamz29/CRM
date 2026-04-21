/**
 * Parsers para extractos bancarios dominicanos.
 *
 * Formatos soportados:
 *   - TXT Banco Popular (formato fijo: cuenta,DD/MM/YYYY,ref,monto,DB|CR,desc,...)
 *   - CSV genérico con columnas estándar (auto-detecta encabezados)
 *   - XLSX (Excel)
 *
 * Todos devuelven un array de ParsedRow con la misma forma. El endpoint
 * luego detecta duplicados e inserta.
 */

import * as XLSX from 'xlsx'

export type ParsedRow = {
  fecha: Date
  tipo: 'credito' | 'debito'
  monto: number
  descripcion: string
  referencia: string | null
}

export type ParseResult = {
  formato: 'banco-popular-txt' | 'csv' | 'xlsx' | 'desconocido'
  rows: ParsedRow[]
  warnings: string[]
}

// ═══════════════════════════════════════════════════════════════════════
// Banco Popular TXT
// ═══════════════════════════════════════════════════════════════════════

function parseBancoPopularLine(line: string): ParsedRow | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const parts = trimmed.split(',')
  if (parts.length < 7) return null

  const fechaStr = parts[1]
  const referencia = parts[2]?.replace(/^0+/, '') || null
  const montoStr = parts[3]
  const tipo = parts[4]?.trim()
  const descripcion = parts[5]?.trim() || ''

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) return null
  const [day, month, year] = fechaStr.split('/')
  const fecha = new Date(`${year}-${month}-${day}T00:00:00Z`)
  if (isNaN(fecha.getTime())) return null

  const monto = parseFloat(montoStr) || 0
  if (monto <= 0) return null

  const tipoMovimiento: 'credito' | 'debito' = tipo === 'CR' ? 'credito' : 'debito'
  const descLimpia = descripcion.replace(/\s{2,}/g, ' ').replace(/RD\$\s*\.00\s*$/, '').trim()

  return { fecha, tipo: tipoMovimiento, monto, descripcion: descLimpia, referencia }
}

export function parseBancoPopularTxt(text: string): ParsedRow[] {
  return text.split(/\r?\n/).map(parseBancoPopularLine).filter((r): r is ParsedRow => r !== null)
}

// ═══════════════════════════════════════════════════════════════════════
// CSV genérico
// ═══════════════════════════════════════════════════════════════════════

// Normaliza un nombre de columna: minúsculas, sin acentos, sin espacios.
function normKey(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Mapeo de columnas comunes → clave canónica
const COLUMN_ALIASES: Record<string, string[]> = {
  fecha: ['fecha', 'fechatransaccion', 'fechaoperacion', 'fechamovimiento', 'date', 'transactiondate', 'fechacontable', 'fechavalor'],
  descripcion: ['descripcion', 'detalle', 'concepto', 'glosa', 'description', 'memo', 'observacion'],
  referencia: ['referencia', 'ref', 'numreferencia', 'nroreferencia', 'reference', 'numoperacion', 'nrooperacion', 'documento'],
  monto: ['monto', 'importe', 'amount', 'valor', 'total'],
  debito: ['debito', 'debit', 'cargo', 'debe', 'salida', 'retiro'],
  credito: ['credito', 'credit', 'abono', 'haber', 'entrada', 'deposito', 'ingreso'],
  tipo: ['tipo', 'type', 'dbcr', 'transaccion', 'operacion'],
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normKey)
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h === alias)
    if (idx >= 0) return idx
  }
  // Búsqueda parcial
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h.includes(alias))
    if (idx >= 0) return idx
  }
  return -1
}

function parseDateFlexible(s: string): Date | null {
  if (!s) return null
  const txt = s.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(txt)) {
    const d = new Date(txt.replace(/\s.*/, '') + 'T00:00:00Z')
    return isNaN(d.getTime()) ? null : d
  }
  // DD/MM/YYYY o DD-MM-YYYY
  const m = txt.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y
    const d = new Date(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00Z`)
    return isNaN(d.getTime()) ? null : d
  }
  // Fecha Excel (número serial)
  const num = parseFloat(txt)
  if (!isNaN(num) && num > 10000 && num < 100000) {
    // Excel epoch: 1900-01-01
    const d = new Date(Date.UTC(1900, 0, 1) + (num - 2) * 86400000)
    return isNaN(d.getTime()) ? null : d
  }
  // Último intento
  const d = new Date(txt)
  return isNaN(d.getTime()) ? null : d
}

function parseMonto(s: string): number {
  if (!s) return 0
  const clean = s.toString().replace(/[^\d.,\-]/g, '').replace(/,(\d{3})/g, '$1').replace(',', '.')
  return Math.abs(parseFloat(clean) || 0)
}

// Parsea CSV → array de rows (primera fila = headers)
function parseCsvText(text: string): string[][] {
  // Simple CSV parser que soporta comillas dobles
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',' || c === ';' || c === '\t') { current.push(field); field = '' }
      else if (c === '\n') { current.push(field); field = ''; rows.push(current); current = [] }
      else field += c
    }
  }
  if (field || current.length) { current.push(field); rows.push(current) }
  return rows.filter(r => r.length > 0 && r.some(c => c.trim()))
}

export function parseTabular(rows: unknown[][]): { parsed: ParsedRow[]; warnings: string[] } {
  if (rows.length < 2) {
    return { parsed: [], warnings: ['Archivo vacío o sin datos'] }
  }

  const headers = rows[0].map(v => String(v ?? ''))
  const warnings: string[] = []

  const idxFecha      = findColumn(headers, COLUMN_ALIASES.fecha)
  const idxDescripcion = findColumn(headers, COLUMN_ALIASES.descripcion)
  const idxReferencia = findColumn(headers, COLUMN_ALIASES.referencia)
  const idxDebito     = findColumn(headers, COLUMN_ALIASES.debito)
  const idxCredito    = findColumn(headers, COLUMN_ALIASES.credito)
  const idxMonto      = findColumn(headers, COLUMN_ALIASES.monto)
  const idxTipo       = findColumn(headers, COLUMN_ALIASES.tipo)

  if (idxFecha < 0) warnings.push(`No se encontró columna de fecha. Columnas detectadas: ${headers.join(', ')}`)
  if (idxDescripcion < 0) warnings.push('No se encontró columna de descripción')

  const hasSeparateDebitCredit = idxDebito >= 0 && idxCredito >= 0
  const hasMontoYTipo = idxMonto >= 0

  if (!hasSeparateDebitCredit && !hasMontoYTipo) {
    warnings.push('No se encontró columna de monto. Se requiere "monto" o ("debito" + "credito").')
    return { parsed: [], warnings }
  }

  const parsed: ParsedRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every(v => !v && v !== 0)) continue

    const fechaRaw = idxFecha >= 0 ? String(row[idxFecha] ?? '') : ''
    const fecha = parseDateFlexible(fechaRaw)
    if (!fecha) continue

    const descripcion = idxDescripcion >= 0 ? String(row[idxDescripcion] ?? '').trim() : ''
    const referencia = idxReferencia >= 0 ? String(row[idxReferencia] ?? '').trim() || null : null

    let monto = 0
    let tipo: 'credito' | 'debito' = 'debito'

    if (hasSeparateDebitCredit) {
      const deb = parseMonto(String(row[idxDebito] ?? ''))
      const cred = parseMonto(String(row[idxCredito] ?? ''))
      if (cred > 0) { monto = cred; tipo = 'credito' }
      else if (deb > 0) { monto = deb; tipo = 'debito' }
    } else {
      const raw = String(row[idxMonto] ?? '')
      monto = parseMonto(raw)
      // Signo o columna tipo
      if (idxTipo >= 0) {
        const t = String(row[idxTipo] ?? '').trim().toLowerCase()
        if (['cr', 'credito', 'credit', 'c', 'abono', 'haber', 'ingreso'].includes(t)) tipo = 'credito'
        else tipo = 'debito'
      } else {
        // Si el monto es negativo → débito, positivo → crédito
        const hasNegative = /-\s*\d/.test(raw)
        tipo = hasNegative ? 'debito' : 'credito'
      }
    }

    if (monto <= 0) continue

    parsed.push({ fecha, tipo, monto, descripcion, referencia })
  }

  return { parsed, warnings }
}

export function parseCsv(text: string): ParseResult {
  const rows = parseCsvText(text)
  const { parsed, warnings } = parseTabular(rows)
  return { formato: 'csv', rows: parsed, warnings }
}

export function parseXlsx(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false })
  const { parsed, warnings } = parseTabular(rows as unknown[][])
  return { formato: 'xlsx', rows: parsed, warnings }
}

// ═══════════════════════════════════════════════════════════════════════
// Detector de formato
// ═══════════════════════════════════════════════════════════════════════

export function detectFormat(fileName: string, textSample: string): 'banco-popular-txt' | 'csv' | 'xlsx' | 'desconocido' {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'

  // Formato Banco Popular: primera línea sin headers, con fecha DD/MM/YYYY en posición [1]
  const firstLine = textSample.split('\n')[0]?.trim() || ''
  const parts = firstLine.split(',')
  if (parts.length >= 7 && /^\d{2}\/\d{2}\/\d{4}$/.test(parts[1] || '')) {
    return 'banco-popular-txt'
  }

  // CSV por defecto si tiene separadores comunes
  if (ext === 'csv' || /[,;\t]/.test(firstLine)) return 'csv'

  return 'desconocido'
}

export async function parseExtracto(file: File): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split('.').pop()

  // XLSX
  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = Buffer.from(await file.arrayBuffer())
    return parseXlsx(buffer)
  }

  // Texto (TXT o CSV)
  const text = await file.text()
  const formato = detectFormat(file.name, text)

  if (formato === 'banco-popular-txt') {
    return {
      formato: 'banco-popular-txt',
      rows: parseBancoPopularTxt(text),
      warnings: [],
    }
  }

  if (formato === 'csv') {
    return parseCsv(text)
  }

  return { formato: 'desconocido', rows: [], warnings: ['Formato no reconocido. Use TXT del Banco Popular, CSV o Excel.'] }
}
