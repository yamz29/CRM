'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { parseRecursosRows, ParseRecursosResult } from '@/lib/excel-parser-recursos'
import { X, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  materiales: 'Materiales', manoObra: 'Mano de Obra', equipos: 'Equipos',
  herramientas: 'Herramientas', subcontratos: 'Subcontratos', transportes: 'Transportes',
  herrajes: 'Herrajes', consumibles: 'Consumibles',
}

type Step = 'upload' | 'preview' | 'done'

interface ImportSummary { creados: number; omitidos: number; errores: string[] }

interface Props {
  onClose: () => void
  onImported: () => void
}

export default function ImportarRecursosModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parseResult, setParseResult] = useState<ParseRecursosResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  // ── Parse file client-side ───────────────────────────────────────────────

  async function handleFile(file: File) {
    setLoading(true)
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      setParseResult(parseRecursosRows(rawRows))
      setStep('preview')
    } catch {
      alert('No se pudo leer el archivo. Usa un .xlsx o .xls válido.')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ── Confirm import ───────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!parseResult || parseResult.recursos.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/recursos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recursos: parseResult.recursos }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Error al importar'); return }
      setSummary(data)
      setStep('done')
      onImported()
    } catch {
      alert('Error de conexión al importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Importar recursos desde Excel
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Template download */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Download className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-800 flex-1">
                  ¿Primera vez? Descarga la plantilla con el formato correcto y complétala.
                </p>
                <a href="/api/recursos/plantilla" download
                  className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
                  <Download className="w-4 h-4" />
                  Plantilla
                </a>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-12 flex flex-col items-center gap-3 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                {loading ? (
                  <p className="text-slate-500 text-sm">Procesando archivo...</p>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-300" />
                    <p className="text-slate-600 font-medium">Arrastra tu archivo aquí</p>
                    <p className="text-slate-400 text-sm">o haz clic para seleccionarlo</p>
                    <p className="text-slate-400 text-xs">.xlsx, .xls</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-700">
                  Archivo: <strong>{fileName}</strong>
                </span>
                <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-700">
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
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Filas con errores (no se importarán)
                  </div>
                  <div className="divide-y divide-red-100">
                    {parseResult.errors.map((e, i) => (
                      <div key={i} className="px-4 py-2 text-xs text-red-700 flex gap-3">
                        <span className="font-mono text-red-400 shrink-0">Fila {e.fila}</span>
                        <span>{e.mensaje}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {parseResult.recursos.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Vista previa — {parseResult.recursos.length} recurso{parseResult.recursos.length !== 1 ? 's' : ''} a importar
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Código</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Nombre</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Tipo</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Categoría</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-500">Unidad</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-500">Costo Unit.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parseResult.recursos.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-mono text-slate-400">{r.codigo || '—'}</td>
                            <td className="px-3 py-1.5 font-medium text-slate-800">{r.nombre}</td>
                            <td className="px-3 py-1.5 text-slate-500">{TIPO_LABELS[r.tipo] || r.tipo}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.categoria || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-600">{r.unidad}</td>
                            <td className="px-3 py-1.5 text-right text-slate-700">{r.costoUnitario > 0 ? r.costoUnitario.toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No hay filas válidas para importar.
                </div>
              )}
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === 'done' && summary && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="w-14 h-14 text-green-500" />
              <h3 className="text-lg font-bold text-slate-800">Importación completada</h3>
              <div className="flex gap-4 text-sm">
                <span className="px-4 py-2 bg-green-100 rounded-lg text-green-700 font-semibold">
                  {summary.creados} creado{summary.creados !== 1 ? 's' : ''}
                </span>
                {summary.omitidos > 0 && (
                  <span className="px-4 py-2 bg-amber-100 rounded-lg text-amber-700 font-semibold">
                    {summary.omitidos} omitido{summary.omitidos !== 1 ? 's' : ''} (código duplicado)
                  </span>
                )}
              </div>
              {summary.errores.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full">
                  {summary.errores.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
          <button onClick={() => { if (step === 'preview') setStep('upload'); else onClose() }}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            {step === 'preview' ? 'Volver' : 'Cerrar'}
          </button>

          {step === 'preview' && parseResult && parseResult.recursos.length > 0 && (
            <button onClick={handleConfirm} disabled={importing}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2">
              {importing ? 'Importando...' : `Confirmar importación (${parseResult.recursos.length} recursos)`}
            </button>
          )}

          {step === 'done' && (
            <button onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
