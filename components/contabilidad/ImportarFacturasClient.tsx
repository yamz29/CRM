'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, FileText, AlertCircle, CheckCircle2, Download, X } from 'lucide-react'
import { parseCsv } from '@/lib/csv'
import { formatCurrency } from '@/lib/utils'

// Canonical column names the API understands
const CANONICAL = [
  'numero',
  'ncf',
  'fecha',
  'fecha_vencimiento',
  'proveedor',
  'rnc_proveedor',
  'descripcion',
  'subtotal',
  'impuesto',
  'total',
  'destino_tipo',
  'proyecto_nombre',
  'observaciones',
] as const

// Map common header aliases (after lowercasing + trimming + removing accents)
// to the canonical column name.
const ALIASES: Record<string, string> = {
  // numero
  numero: 'numero',
  'no.': 'numero',
  no: 'numero',
  'no factura': 'numero',
  'numero factura': 'numero',
  factura: 'numero',
  num: 'numero',
  // ncf
  ncf: 'ncf',
  comprobante: 'ncf',
  'e-cf': 'ncf',
  ecf: 'ncf',
  // fecha
  fecha: 'fecha',
  'fecha emision': 'fecha',
  'fecha de emision': 'fecha',
  // vencimiento
  vencimiento: 'fecha_vencimiento',
  'fecha vencimiento': 'fecha_vencimiento',
  'fecha de vencimiento': 'fecha_vencimiento',
  // proveedor
  proveedor: 'proveedor',
  suplidor: 'proveedor',
  // rnc
  rnc: 'rnc_proveedor',
  'rnc proveedor': 'rnc_proveedor',
  'rnc del proveedor': 'rnc_proveedor',
  cedula: 'rnc_proveedor',
  // descripcion
  descripcion: 'descripcion',
  concepto: 'descripcion',
  detalle: 'descripcion',
  // numeros
  subtotal: 'subtotal',
  impuesto: 'impuesto',
  itbis: 'impuesto',
  iva: 'impuesto',
  total: 'total',
  monto: 'total',
  // destino
  destino: 'destino_tipo',
  'destino tipo': 'destino_tipo',
  'tipo destino': 'destino_tipo',
  // proyecto
  proyecto: 'proyecto_nombre',
  'proyecto nombre': 'proyecto_nombre',
  'nombre proyecto': 'proyecto_nombre',
  // observaciones
  observaciones: 'observaciones',
  notas: 'observaciones',
  observacion: 'observaciones',
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
}

interface ParsedRow {
  [key: string]: string
}

interface ValidatedRow {
  index: number
  ok: boolean
  errors: string[]
  data?: {
    numero: string
    ncf: string | null
    tipo: string
    fecha: string
    fechaVencimiento: string | null
    proveedor: string | null
    rncProveedor: string | null
    descripcion: string | null
    subtotal: number
    impuesto: number
    total: number
    destinoTipo: string
    proyectoId: number | null
    observaciones: string | null
  }
  raw: ParsedRow
}

interface PreviewResult {
  total: number
  valid: number
  invalid: number
  rows: ValidatedRow[]
  created?: number
}

const PLANTILLA_CSV =
  'numero,ncf,fecha,fecha_vencimiento,proveedor,rnc_proveedor,descripcion,subtotal,impuesto,total,destino_tipo,proyecto_nombre,observaciones\n' +
  'F-001,B0100000001,2026-04-01,2026-04-30,Ferretería Central,131012345,Compra de cemento,5000,900,5900,proyecto,Casa Pérez,\n' +
  'F-002,,2026-04-02,,Pinturas RD,,Compra de pintura,2000,360,2360,oficina,,\n'

export function ImportarFacturasClient() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [unrecognizedHeaders, setUnrecognizedHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [importResult, setImportResult] = useState<PreviewResult | null>(null)

  const reset = () => {
    setFile(null)
    setParseError(null)
    setParsedRows([])
    setUnrecognizedHeaders([])
    setPreview(null)
    setImportResult(null)
  }

  const handleFile = async (f: File) => {
    reset()
    setFile(f)
    try {
      const text = await f.text()
      const matrix = parseCsv(text)
      if (matrix.length < 2) {
        setParseError('El archivo está vacío o solo tiene encabezados')
        return
      }
      const headers = matrix[0].map(normalizeHeader)
      const canonicalSet = new Set<string>(CANONICAL)
      const mapped: (string | null)[] = headers.map((h) => {
        if (canonicalSet.has(h)) return h
        return ALIASES[h] ?? null
      })
      const unrecognized = headers.filter((h, i) => mapped[i] === null && h)
      setUnrecognizedHeaders(unrecognized)

      const rows: ParsedRow[] = []
      for (let r = 1; r < matrix.length; r++) {
        const cells = matrix[r]
        // Skip rows that are entirely empty
        if (cells.every((c) => !c?.trim())) continue
        const obj: ParsedRow = {}
        for (let i = 0; i < headers.length; i++) {
          const key = mapped[i]
          if (key) obj[key] = (cells[i] ?? '').trim()
        }
        rows.push(obj)
      }
      setParsedRows(rows)

      // Auto-trigger dry-run preview
      await runPreview(rows)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al leer el archivo')
    }
  }

  const runPreview = async (rows: ParsedRow[]) => {
    setLoading(true)
    try {
      const res = await fetch('/api/contabilidad/facturas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, dryRun: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al validar')
      setPreview(data)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al validar')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (parsedRows.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/contabilidad/facturas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al importar')
      setImportResult(data)
      startTransition(() => router.refresh())
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setLoading(false)
    }
  }

  const downloadPlantilla = () => {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla-facturas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (importResult) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
          <h2 className="text-xl font-bold text-foreground">Importación completada</h2>
          <p className="text-muted-foreground">
            Se crearon {importResult.created} de {importResult.total} facturas.
            {importResult.invalid > 0 && (
              <> {importResult.invalid} fila(s) tenían errores y fueron omitidas.</>
            )}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => router.push('/contabilidad?tab=facturas')}>
              Ver facturas
            </Button>
            <Button variant="secondary" onClick={reset}>
              Importar otro archivo
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">Cómo importar</h3>
              <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Solo se importan facturas de <strong>egreso</strong> (proveedores)</li>
                <li>Columnas mínimas: <code className="text-xs">numero</code>, <code className="text-xs">fecha</code>, <code className="text-xs">total</code></li>
                <li>Si <code className="text-xs">total</code> está vacío, se calcula como <code className="text-xs">subtotal + impuesto</code></li>
                <li>Para vincular a un proyecto: <code className="text-xs">destino_tipo=proyecto</code> y <code className="text-xs">proyecto_nombre</code> con el nombre exacto</li>
                <li>Los números duplicados (en el archivo o ya en la BD) se omiten</li>
                <li>Las facturas se crean en estado <strong>pendiente</strong></li>
              </ul>
            </div>
            <Button variant="secondary" size="sm" onClick={downloadPlantilla} className="flex-shrink-0">
              <Download className="w-4 h-4" /> Plantilla CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File picker */}
      {!file && (
        <Card>
          <CardContent className="py-12">
            <label className="flex flex-col items-center justify-center gap-3 cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">Selecciona un archivo CSV</p>
                <p className="text-sm text-muted-foreground mt-0.5">o arrástralo aquí</p>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* File loaded */}
      {file && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedRows.length} fila(s) detectada(s)
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="w-4 h-4" /> Quitar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Errors / warnings */}
      {parseError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {parseError}
        </div>
      )}

      {unrecognizedHeaders.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Columnas no reconocidas (serán ignoradas):</p>
            <p className="text-xs mt-0.5">{unrecognizedHeaders.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <Card>
          <CardContent className="py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Vista previa</h3>
                <p className="text-sm text-muted-foreground">
                  {preview.valid} válida(s) · {preview.invalid} con errores · {preview.total} total
                </p>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={loading || preview.valid === 0}
                className="min-w-44"
              >
                {loading
                  ? 'Importando...'
                  : `Confirmar e importar ${preview.valid} factura(s)`}
              </Button>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold w-12">#</th>
                    <th className="px-3 py-2 text-left font-semibold w-8" />
                    <th className="px-3 py-2 text-left font-semibold">Número</th>
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Proveedor</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                    <th className="px-3 py-2 text-left font-semibold">Destino</th>
                    <th className="px-3 py-2 text-left font-semibold">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.map((row) => (
                    <tr key={row.index} className={row.ok ? '' : 'bg-red-50/40'}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.index}</td>
                      <td className="px-3 py-2">
                        {row.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.raw.numero || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.raw.fecha || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                        {row.raw.proveedor || '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {row.data ? formatCurrency(row.data.total) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.data?.destinoTipo || row.raw.destino_tipo || 'general'}
                        {row.data?.proyectoId && <span className="block text-muted-foreground">→ proyecto #{row.data.proyectoId}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-red-600">
                        {row.errors.length > 0 ? row.errors.join('; ') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
