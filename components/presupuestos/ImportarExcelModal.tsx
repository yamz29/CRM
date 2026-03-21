'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { parseExcelRows, ParseResult, ParsedTitulo, ParsedCapitulo, ParsedPartida } from '@/lib/excel-parser'

// ── Types that match PresupuestoV2Builder's internal state ─────────────────

export interface ImportedTitulo {
  nombre: string
  orden: number
}

export interface ImportedCapitulo {
  nombre: string
  tituloIdx: number | null
  orden: number
  partidas: ImportedPartida[]
}

export interface ImportedPartida {
  codigo: string
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  observaciones: string
  orden: number
}

export interface ImportResult {
  titulos: ImportedTitulo[]
  capitulos: ImportedCapitulo[]
}

interface Props {
  onClose: () => void
  onImport: (result: ImportResult) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildImportResult(parsed: ParseResult): ImportResult {
  const titulos: ImportedTitulo[] = parsed.titulos.map(t => ({ nombre: t.nombre, orden: t.orden }))

  const capitulos: ImportedCapitulo[] = parsed.capitulos.map((cap: ParsedCapitulo) => {
    const capPartidas: ImportedPartida[] = parsed.partidas
      .filter((p: ParsedPartida) => p.capituloIdx === parsed.capitulos.indexOf(cap))
      .map((p: ParsedPartida) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        subtotal: p.subtotal,
        observaciones: p.observaciones,
        orden: p.orden,
      }))

    return {
      nombre: cap.nombre,
      tituloIdx: cap.tituloIdx,
      orden: cap.orden,
      partidas: capPartidas,
    }
  })

  return { titulos, capitulos }
}

function fmtNum(n: number) {
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// ── Component ──────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'done'

export default function ImportarExcelModal({ onClose, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')

  // ── Parse file client-side ────────────────────────────────────────────────

  async function handleFile(file: File) {
    setLoading(true)
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheetName = wb.SheetNames[0]
      const ws = wb.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const result = parseExcelRows(rawRows)
      setParseResult(result)
      setStep('preview')
    } catch (err) {
      console.error(err)
      alert('No se pudo leer el archivo. Asegúrate de que sea un archivo .xlsx o .xls válido.')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleConfirm() {
    if (!parseResult) return
    const result = buildImportResult(parseResult)
    onImport(result)
    setStep('done')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalImport = parseResult ? parseResult.capitulos.reduce((s, _) => s, 0) : 0
  void totalImport

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Importar partidas desde Excel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download template */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
                <p className="text-sm text-blue-800">
                  ¿Primera vez? Descarga la plantilla con el formato correcto y rellénala con tus partidas.
                </p>
                <a
                  href="/api/presupuestos-v2/plantilla"
                  download
                  className="shrink-0 ml-auto px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar plantilla
                </a>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center gap-3 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                {loading ? (
                  <div className="text-gray-500 text-sm">Procesando archivo...</div>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-600 font-medium">Arrastra tu archivo aquí</p>
                    <p className="text-gray-400 text-sm">o haz clic para seleccionarlo</p>
                    <p className="text-gray-400 text-xs">.xlsx, .xls</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  Archivo: <strong>{fileName}</strong>
                </span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                  Filas leídas: <strong>{parseResult.totalRows}</strong>
                </span>
                <span className="px-3 py-1 bg-green-100 rounded-full text-green-700">
                  Válidas: <strong>{parseResult.validRows}</strong>
                </span>
                {parseResult.errors.length > 0 && (
                  <span className="px-3 py-1 bg-red-100 rounded-full text-red-700">
                    Errores: <strong>{parseResult.errors.length}</strong>
                  </span>
                )}
                <span className="px-3 py-1 bg-blue-100 rounded-full text-blue-700">
                  Títulos: <strong>{parseResult.titulos.length}</strong>
                </span>
                <span className="px-3 py-1 bg-blue-100 rounded-full text-blue-700">
                  Capítulos: <strong>{parseResult.capitulos.length}</strong>
                </span>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
                    Filas con errores (no se importarán)
                  </div>
                  <div className="divide-y divide-red-100 max-h-40 overflow-y-auto">
                    {parseResult.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2 text-sm text-red-600">
                        <span className="font-medium">Fila {e.fila}:</span> {e.mensaje}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {parseResult.validRows === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay partidas válidas para importar. Revisa los errores anteriores.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Vista previa de partidas a importar
                  </div>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Título</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Capítulo</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Código</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Descripción</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Ud.</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Cantidad</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">P. Unit.</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parseResult.partidas.map((p, i) => {
                          const cap = parseResult.capitulos[p.capituloIdx]
                          const tit = cap?.tituloIdx != null ? parseResult.titulos[cap.tituloIdx] : null
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 text-gray-500 text-xs">{tit?.nombre ?? '—'}</td>
                              <td className="px-3 py-1.5 text-gray-700">{cap?.nombre ?? '—'}</td>
                              <td className="px-3 py-1.5 text-gray-500 font-mono text-xs">{p.codigo || '—'}</td>
                              <td className="px-3 py-1.5 text-gray-900 max-w-xs truncate">{p.descripcion}</td>
                              <td className="px-3 py-1.5 text-gray-600">{p.unidad}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{fmtNum(p.cantidad)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{fmtNum(p.precioUnitario)}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-gray-900">{fmtNum(p.subtotal)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold text-lg">Importación aplicada</p>
              <p className="text-gray-500 text-sm text-center">
                Las partidas han sido cargadas en el presupuesto. Revisa y guarda los cambios.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center gap-3">
          {step === 'preview' && (
            <button
              onClick={() => { setStep('upload'); setParseResult(null); setFileName('') }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Volver
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              {step === 'done' ? 'Cerrar' : 'Cancelar'}
            </button>
            {step === 'preview' && parseResult && parseResult.validRows > 0 && (
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Importar {parseResult.validRows} partida{parseResult.validRows !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
