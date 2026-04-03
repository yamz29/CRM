'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  X, Upload, FileText, Download, AlertCircle, CheckCircle2,
  AlertTriangle, ChevronRight, RotateCcw,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// ── Types ─────────────────────────────────────────────────────────────

interface ParsedRow {
  _fila: number
  fecha: string
  tipoGasto: string
  referencia: string
  descripcion: string
  suplidor: string
  categoria: string
  subcategoria: string
  monto: string
  moneda: string
  metodoPago: string
  cuentaOrigen: string
  observaciones: string
  estado: string
  _errores: string[]
  _valida: boolean
}

type Step = 'upload' | 'preview' | 'done'

// ── Constants ─────────────────────────────────────────────────────────

const TIPOS_VALIDOS = ['Factura', 'Gasto menor', 'Transferencia', 'Caja chica',
  'Compra de materiales', 'Mano de obra', 'Transporte', 'Subcontrato', 'Servicio', 'Otro']
const METODOS_VALIDOS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Caja chica', 'Otro']
const ESTADOS_VALIDOS = ['Registrado', 'Revisado', 'Anulado']

const REQUIRED_HEADERS = ['fecha', 'descripcion', 'monto']

// Maps of alternate header names → canonical name
const HEADER_MAP: Record<string, string> = {
  // fecha
  fecha: 'fecha', date: 'fecha', 'fecha gasto': 'fecha', 'fecha del gasto': 'fecha',
  // tipoGasto
  tipo_gasto: 'tipoGasto', tipogasto: 'tipoGasto', tipo: 'tipoGasto', 'tipo de gasto': 'tipoGasto', type: 'tipoGasto',
  // referencia
  referencia: 'referencia', ref: 'referencia', comprobante: 'referencia', 'numero comprobante': 'referencia',
  'nro comprobante': 'referencia', ncf: 'referencia',
  // descripcion
  descripcion: 'descripcion', description: 'descripcion', detalle: 'descripcion', concepto: 'descripcion',
  // suplidor
  suplidor: 'suplidor', proveedor: 'suplidor', beneficiario: 'suplidor', supplier: 'suplidor',
  // categoria
  categoria: 'categoria', category: 'categoria',
  // subcategoria
  subcategoria: 'subcategoria', subcategory: 'subcategoria',
  // monto
  monto: 'monto', amount: 'monto', valor: 'monto', importe: 'monto', total: 'monto',
  // moneda
  moneda: 'moneda', currency: 'moneda',
  // metodoPago
  metodo_pago: 'metodoPago', metodopago: 'metodoPago', 'metodo de pago': 'metodoPago',
  pago: 'metodoPago', 'forma de pago': 'metodoPago', payment: 'metodoPago',
  // cuentaOrigen
  cuenta_origen: 'cuentaOrigen', cuentaorigen: 'cuentaOrigen', cuenta: 'cuentaOrigen',
  'cuenta origen': 'cuentaOrigen', caja: 'cuentaOrigen',
  // observaciones
  observaciones: 'observaciones', notas: 'observaciones', notes: 'observaciones',
  comentarios: 'observaciones', remarks: 'observaciones',
  // estado
  estado: 'estado', status: 'estado', estatus: 'estado',
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/\s+/g, ' ')
}

function mapHeader(raw: string): string {
  const n = normalizeKey(raw)
  return HEADER_MAP[n] ?? HEADER_MAP[n.replace(/\s/g, '_')] ?? HEADER_MAP[n.replace(/\s/g, '')] ?? n
}

// ── CSV parser (handles quoted fields, CRLF/LF, commas inside quotes) ─

function parseCSV(text: string): Record<string, string>[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === '"') {
      if (inQuote && normalized[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === '\n' && !inQuote) {
      lines.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) lines.push(cur)

  const nonEmpty = lines.filter(l => l.trim())
  if (nonEmpty.length < 2) return []

  const rawHeaders = splitCSVLine(nonEmpty[0])
  const headers = rawHeaders.map(mapHeader)

  return nonEmpty.slice(1).map(line => {
    const vals = splitCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return row
  })
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

// ── XLSX parser ────────────────────────────────────────────────────────

function parseXLSX(buf: ArrayBuffer): Record<string, string>[] {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,
    dateNF: 'YYYY-MM-DD',
    defval: '',
  })
  return raw.map(row => {
    const mapped: Record<string, string> = {}
    Object.entries(row).forEach(([k, v]) => {
      mapped[mapHeader(k)] = String(v ?? '').trim()
    })
    return mapped
  })
}

// ── Row validator ──────────────────────────────────────────────────────

function validateRow(raw: Record<string, string>, index: number): ParsedRow {
  const errores: string[] = []

  const fecha = raw.fecha?.trim() ?? ''
  const descripcion = raw.descripcion?.trim() ?? ''
  const montoStr = raw.monto?.trim() ?? ''
  const tipoGasto = raw.tipoGasto?.trim() || 'Gasto menor'
  const metodoPago = raw.metodoPago?.trim() || 'Efectivo'
  const estado = raw.estado?.trim() || 'Registrado'

  if (!fecha) errores.push('Fecha requerida')
  else if (isNaN(new Date(fecha).getTime())) errores.push(`Fecha inválida: "${fecha}"`)

  if (!descripcion) errores.push('Descripción requerida')

  if (!montoStr) errores.push('Monto requerido')
  else {
    const n = parseFloat(montoStr.replace(',', '.'))
    if (isNaN(n)) errores.push(`Monto inválido: "${montoStr}"`)
    else if (n < 0) errores.push('Monto no puede ser negativo')
  }

  if (!TIPOS_VALIDOS.includes(tipoGasto))
    errores.push(`Tipo inválido: "${tipoGasto}"`)
  if (!METODOS_VALIDOS.includes(metodoPago))
    errores.push(`Método inválido: "${metodoPago}"`)
  if (!ESTADOS_VALIDOS.includes(estado))
    errores.push(`Estado inválido: "${estado}"`)

  return {
    _fila: index + 2,
    fecha,
    tipoGasto,
    referencia: raw.referencia?.trim() ?? '',
    descripcion,
    suplidor: raw.suplidor?.trim() ?? '',
    categoria: raw.categoria?.trim() ?? '',
    subcategoria: raw.subcategoria?.trim() ?? '',
    monto: montoStr.replace(',', '.'),
    moneda: raw.moneda?.trim() || 'RD$',
    metodoPago,
    cuentaOrigen: raw.cuentaOrigen?.trim() ?? '',
    observaciones: raw.observaciones?.trim() ?? '',
    estado,
    _errores: errores,
    _valida: errores.length === 0,
  }
}

// ── Main component ────────────────────────────────────────────────────

export function ImportarGastosModal({
  proyectoId,
  onClose,
  onImported,
}: {
  proyectoId: number
  onClose: () => void
  onImported: () => void
}) {
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [filename, setFilename] = useState('')
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ importados: number; errores: { fila: number; error: string }[] } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showOnlyErrors, setShowOnlyErrors] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const valid = rows.filter(r => r._valida)
  const invalid = rows.filter(r => !r._valida)
  const displayed = showOnlyErrors ? invalid : rows

  // ── File processing ──────────────────────────────────────────────────

  async function processFile(file: File) {
    setParseError(null)
    setHeaderError(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setParseError('Solo se aceptan archivos .csv, .xlsx o .xls')
      return
    }

    let rawRows: Record<string, string>[]
    try {
      if (ext === 'csv') {
        rawRows = parseCSV(await file.text())
      } else {
        rawRows = parseXLSX(await file.arrayBuffer())
      }
    } catch {
      setParseError('No se pudo leer el archivo. Verifica que esté bien formado.')
      return
    }

    if (rawRows.length === 0) {
      setParseError('El archivo está vacío o no tiene filas de datos.')
      return
    }

    // Header validation
    const firstRow = rawRows[0]
    const foundHeaders = Object.keys(firstRow)
    const missing = REQUIRED_HEADERS.filter(h => !foundHeaders.includes(h))
    if (missing.length > 0) {
      setHeaderError(
        `Faltan columnas requeridas: ${missing.join(', ')}.\n` +
        `Columnas encontradas: ${foundHeaders.join(', ')}`
      )
      return
    }

    setFilename(file.name)
    setRows(rawRows.map((r, i) => validateRow(r, i)))
    setStep('preview')
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  // ── Import ───────────────────────────────────────────────────────────

  async function handleImport() {
    if (valid.length === 0) return
    setImporting(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: valid }),
      })
      const data = await res.json()
      setImportResult(data)
      setStep('done')
      if (data.importados > 0) onImported()
    } catch {
      setParseError('Error de red al importar. Intenta de nuevo.')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setStep('upload')
    setRows([])
    setFilename('')
    setHeaderError(null)
    setParseError(null)
    setImportResult(null)
    setShowOnlyErrors(false)
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Importar gastos
            </h2>
            {/* Step indicators */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={step === 'upload' ? 'text-blue-600 font-semibold' : step === 'preview' || step === 'done' ? 'text-green-600' : ''}>
                1. Archivo
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className={step === 'preview' ? 'text-blue-600 font-semibold' : step === 'done' ? 'text-green-600' : ''}>
                2. Revisión
              </span>
              <ChevronRight className="w-3 h-3" />
              <span className={step === 'done' ? 'text-green-600 font-semibold' : ''}>
                3. Resultado
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-12 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${dragging ? 'border-blue-500 bg-blue-50' : 'border-border hover:border-blue-400 hover:bg-muted'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${dragging ? 'bg-blue-100' : 'bg-muted'}`}>
                  <Upload className={`w-7 h-7 ${dragging ? 'text-blue-600' : 'text-muted-foreground'}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {dragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo aquí'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar · CSV, XLSX, XLS</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />

              {/* Errors */}
              {parseError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
              {headerError && (
                <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <div className="text-amber-800 whitespace-pre-line">{headerError}</div>
                </div>
              )}

              {/* Template + column reference */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/40 border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-foreground mb-2">¿Primera vez importando?</p>
                  <p className="text-xs text-muted-foreground mb-3">Descarga la plantilla base con los encabezados correctos y ejemplos de datos.</p>
                  <Button size="sm" variant="secondary" onClick={() => window.open(`/api/proyectos/${proyectoId}/gastos/plantilla`, '_blank')}>
                    <Download className="w-3.5 h-3.5" /> Descargar plantilla CSV
                  </Button>
                </div>
                <div className="bg-muted/40 border border-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-foreground mb-2">Columnas requeridas</p>
                  <div className="flex flex-wrap gap-1">
                    {REQUIRED_HEADERS.map(h => (
                      <span key={h} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono">{h}</span>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-foreground mt-2 mb-1">Columnas opcionales</p>
                  <div className="flex flex-wrap gap-1">
                    {['tipoGasto','referencia','suplidor','categoria','subcategoria','moneda','metodoPago','cuentaOrigen','observaciones','estado'].map(h => (
                      <span key={h} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono">{h}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accepted values reference */}
              <details className="text-xs text-muted-foreground border border-border rounded-lg">
                <summary className="cursor-pointer px-4 py-2 hover:bg-muted rounded-lg font-medium text-muted-foreground">
                  Ver valores aceptados por columna
                </summary>
                <div className="px-4 pb-3 space-y-1.5 mt-2">
                  <p><span className="font-semibold text-foreground">tipoGasto:</span> {TIPOS_VALIDOS.join(' · ')}</p>
                  <p><span className="font-semibold text-foreground">metodoPago:</span> {METODOS_VALIDOS.join(' · ')}</p>
                  <p><span className="font-semibold text-foreground">estado:</span> {ESTADOS_VALIDOS.join(' · ')}</p>
                  <p><span className="font-semibold text-foreground">moneda:</span> RD$ · USD · EUR (por defecto RD$)</p>
                  <p><span className="font-semibold text-foreground">fecha:</span> YYYY-MM-DD (ej: 2026-03-15)</p>
                </div>
              </details>
            </div>
          )}

          {/* ── STEP 2: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{filename}</span>
                  <span className="text-xs text-muted-foreground">{rows.length} filas leídas</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> {valid.length} válidas
                  </span>
                  {invalid.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3" /> {invalid.length} con errores
                    </span>
                  )}
                  <button
                    onClick={reset}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Cambiar archivo
                  </button>
                </div>
              </div>

              {/* Filter toggle */}
              {invalid.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowOnlyErrors(false)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${!showOnlyErrors ? 'bg-slate-800 text-white border-slate-800' : 'bg-card text-muted-foreground border-border hover:border-border'}`}
                  >
                    Todas ({rows.length})
                  </button>
                  <button
                    onClick={() => setShowOnlyErrors(true)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${showOnlyErrors ? 'bg-red-600 text-white border-red-600' : 'bg-card text-red-500 border-red-200 hover:border-red-300'}`}
                  >
                    Solo con errores ({invalid.length})
                  </button>
                </div>
              )}

              {/* Preview table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-10 border-b border-border">Fila</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-8 border-b border-border"></th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-24 border-b border-border">Fecha</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold border-b border-border">Descripción</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-32 border-b border-border">Tipo</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-28 border-b border-border">Suplidor</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-24 border-b border-border">Categoría</th>
                        <th className="px-3 py-2 text-right text-muted-foreground font-semibold w-24 border-b border-border">Monto</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold w-28 border-b border-border">Método pago</th>
                        <th className="px-3 py-2 text-left text-muted-foreground font-semibold border-b border-border">Errores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayed.map(row => (
                        <tr key={row._fila} className={row._valida ? 'hover:bg-green-50/30' : 'bg-red-50 hover:bg-red-100/50'}>
                          <td className="px-3 py-2 text-muted-foreground font-mono">{row._fila}</td>
                          <td className="px-3 py-2 text-center">
                            {row._valida
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                              : <AlertCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono">{row.fecha || <span className="text-red-400 italic">vacío</span>}</td>
                          <td className="px-3 py-2 text-foreground max-w-[180px]">
                            <span className="truncate block" title={row.descripcion}>
                              {row.descripcion || <span className="text-red-400 italic">vacío</span>}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.tipoGasto}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[100px]">
                            <span className="truncate block">{row.suplidor || <span className="text-muted-foreground/70">—</span>}</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.categoria || <span className="text-muted-foreground/70">—</span>}</td>
                          <td className="px-3 py-2 text-right font-mono text-foreground">
                            {row.monto
                              ? parseFloat(row.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })
                              : <span className="text-red-400 italic">vacío</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.metodoPago}</td>
                          <td className="px-3 py-2">
                            {row._errores.length > 0 && (
                              <ul className="space-y-0.5">
                                {row._errores.map((e, i) => (
                                  <li key={i} className="text-red-600 flex items-start gap-1">
                                    <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                                    {e}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {invalid.length > 0 && valid.length > 0 && (
                <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                  <span className="text-amber-800">
                    {invalid.length} filas tienen errores y <strong>no se importarán</strong>.
                    Solo se importarán las {valid.length} filas válidas.
                    Puedes corregir el archivo y volver a subirlo.
                  </span>
                </div>
              )}
              {valid.length === 0 && (
                <div className="flex items-start gap-2 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                  <span className="text-red-700">
                    No hay filas válidas para importar. Corrige los errores en el archivo y vuelve a subirlo.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 'done' && importResult && (
            <div className="py-8 flex flex-col items-center gap-5 text-center">
              {importResult.importados > 0 ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">
                      {importResult.importados} {importResult.importados === 1 ? 'gasto importado' : 'gastos importados'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Se registraron correctamente en este proyecto.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-9 h-9 text-red-500" />
                  </div>
                  <p className="text-lg font-bold text-foreground">No se importó ningún gasto</p>
                </>
              )}

              {importResult.errores?.length > 0 && (
                <div className="w-full max-w-md bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-amber-700 mb-2">
                    {importResult.errores.length} filas rechazadas por el servidor:
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errores.map((e, i) => (
                      <li key={i} className="text-xs text-amber-800">
                        Fila {e.fila}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                {importResult.importados > 0 && (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    <Upload className="w-3.5 h-3.5" /> Importar otro archivo
                  </Button>
                )}
                {importResult.importados === 0 && (
                  <Button size="sm" variant="secondary" onClick={reset}>
                    <RotateCcw className="w-3.5 h-3.5" /> Intentar de nuevo
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-muted-foreground">
            {step === 'preview' && rows.length > 0 && (
              <>El proyecto se asignará automáticamente a todas las filas importadas.</>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'preview' && valid.length > 0 && (
              <Button size="sm" onClick={handleImport} disabled={importing}>
                <Upload className="w-3.5 h-3.5" />
                {importing ? 'Importando...' : `Importar ${valid.length} gasto${valid.length !== 1 ? 's' : ''}`}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={onClose}>
              {step === 'done' ? 'Cerrar' : 'Cancelar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
