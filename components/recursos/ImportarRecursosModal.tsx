'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { parseRecursosRows, ParseRecursosResult } from '@/lib/excel-parser-recursos'
import { X, Upload, Download, CheckCircle, AlertCircle, RefreshCw, PlusCircle, Settings2 } from 'lucide-react'

const TIPO_LABELS: Record<string, string> = {
  materiales: 'Materiales', manoObra: 'Mano de Obra', equipos: 'Equipos',
  herramientas: 'Herramientas', subcontratos: 'Subcontratos', transportes: 'Transportes',
  herrajes: 'Herrajes', consumibles: 'Consumibles',
}

type Step = 'upload' | 'preview' | 'done'
type Modo = 'crear_actualizar' | 'solo_crear' | 'solo_actualizar'

interface ImportSummary {
  loteId?: number
  creados: number
  actualizados: number
  preciosCambiados: number
  omitidos: number
  errores: string[]
}

interface Props {
  onClose: () => void
  onImported: () => void
}

const MODOS: { value: Modo; label: string; desc: string }[] = [
  { value: 'crear_actualizar', label: 'Crear + Actualizar', desc: 'Crea recursos nuevos y actualiza los que ya existen por código' },
  { value: 'solo_crear',       label: 'Solo crear nuevos',  desc: 'Omite los que ya existen, solo crea recursos que no están en el catálogo' },
  { value: 'solo_actualizar',  label: 'Solo actualizar',    desc: 'Solo modifica recursos existentes por código, omite los nuevos' },
]

export default function ImportarRecursosModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep]               = useState<Step>('upload')
  const [loading, setLoading]         = useState(false)
  const [importing, setImporting]     = useState(false)
  const [parseResult, setParseResult] = useState<ParseRecursosResult | null>(null)
  const [fileName, setFileName]       = useState('')
  const [summary, setSummary]         = useState<ImportSummary | null>(null)
  const [modo, setModo]               = useState<Modo>('crear_actualizar')

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
        body: JSON.stringify({ recursos: parseResult.recursos, modo, nombreArchivo: fileName }),
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

  const modoActual = MODOS.find(m => m.value === modo)!

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

              {/* Modo selector */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Settings2 className="w-4 h-4 text-slate-400" />
                  Modo de importación
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {MODOS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setModo(m.value)}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${
                        modo === m.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-xs font-semibold ${modo === m.value ? 'text-blue-700' : 'text-slate-700'}`}>
                        {m.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template download */}
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Download className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-800 flex-1">
                  ¿Primera vez? Descarga la plantilla con el formato correcto y complétala.
                  Incluye ejemplos con <strong>CEM-001, MEL-RH18-BL, MO-TALLER</strong> y más.
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

              {/* Modo badge */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <Settings2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">Modo: <strong className="text-slate-800">{modoActual.label}</strong></span>
                <span className="text-xs text-slate-400 ml-1">— {modoActual.desc}</span>
              </div>

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
                    Vista previa — {parseResult.recursos.length} recurso{parseResult.recursos.length !== 1 ? 's' : ''} a procesar
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
                          <th className="px-3 py-2 text-center font-semibold text-slate-500">Activo</th>
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
                            <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                              {r.costoUnitario > 0 ? `RD$ ${r.costoUnitario.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${r.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {r.activo ? 'Sí' : 'No'}
                              </span>
                            </td>
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
            <div className="flex flex-col items-center gap-5 py-6">
              <CheckCircle className="w-14 h-14 text-green-500" />
              <h3 className="text-lg font-bold text-slate-800">Importación completada</h3>

              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {summary.creados > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                    <PlusCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-green-600">Creados</p>
                      <p className="text-lg font-bold text-green-700">{summary.creados}</p>
                    </div>
                  </div>
                )}
                {summary.actualizados > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-600">Actualizados</p>
                      <p className="text-lg font-bold text-blue-700">{summary.actualizados}</p>
                    </div>
                  </div>
                )}
                {summary.preciosCambiados > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs text-amber-600">Precios cambiados</p>
                      <p className="text-lg font-bold text-amber-700">{summary.preciosCambiados}</p>
                    </div>
                  </div>
                )}
                {summary.omitidos > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <X className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Omitidos</p>
                      <p className="text-lg font-bold text-slate-600">{summary.omitidos}</p>
                    </div>
                  </div>
                )}
              </div>

              {summary.loteId && (
                <p className="text-xs text-slate-400">Lote de importación #{summary.loteId} registrado</p>
              )}

              {summary.errores.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 w-full">
                  <p className="font-semibold mb-1">Errores al procesar:</p>
                  {summary.errores.map((e, i) => <div key={i} className="mt-0.5">• {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={() => { if (step === 'preview') setStep('upload'); else onClose() }}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
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
