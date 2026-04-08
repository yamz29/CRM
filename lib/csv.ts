// Minimal CSV parser. Handles:
//   - quoted fields containing commas, newlines, and escaped quotes ("")
//   - both LF and CRLF line endings
//   - auto-detects ',' or ';' as delimiter
// Returns rows as arrays of strings. Header parsing is the caller's job.

export function parseCsv(text: string): string[][] {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  // Auto-detect delimiter from first non-quoted line
  const sample = text.slice(0, 2000)
  const commas = (sample.match(/,/g) || []).length
  const semis = (sample.match(/;/g) || []).length
  const delim = semis > commas ? ';' : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
      continue
    }

    if (c === delim) {
      row.push(field)
      field = ''
      i++
      continue
    }

    if (c === '\r') {
      // swallow CR; LF will close the row
      i++
      continue
    }

    if (c === '\n') {
      row.push(field)
      // skip fully empty rows
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      field = ''
      i++
      continue
    }

    field += c
    i++
  }

  // last field/row if file doesn't end with newline
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }

  return rows
}

// Parses a date in YYYY-MM-DD or DD/MM/YYYY (or with - separators).
// Returns null on failure or empty input.
export function parseFlexibleDate(input: string | null | undefined): Date | null {
  if (!input) return null
  const s = input.trim()
  if (!s) return null

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    const date = new Date(Number(y), Number(mo) - 1, Number(d))
    return isNaN(date.getTime()) ? null : date
  }

  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    const date = new Date(Number(y), Number(mo) - 1, Number(d))
    return isNaN(date.getTime()) ? null : date
  }

  // Fallback: let JS try
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Parses a number that may use ',' as decimal separator or thousands separator.
// Returns NaN on bad input.
export function parseFlexibleNumber(input: string | null | undefined): number {
  if (input == null) return NaN
  const s = String(input).trim()
  if (!s) return NaN
  // If both '.' and ',' are present, assume '.' = thousands and ',' = decimal
  if (s.includes('.') && s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  // Only ',' present → treat as decimal
  if (s.includes(',') && !s.includes('.')) {
    return parseFloat(s.replace(',', '.'))
  }
  return parseFloat(s)
}
