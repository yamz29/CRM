'use client'

import { useState, useRef } from 'react'
import { X, Upload, Download, Loader2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface RowPreview {
  fecha: string
  tipo: 'credito' | 'debito'
  monto: number
  descripcion: string
  referencia: string | null
  duplicado: boolean
}

interface Props {
  cuentaId: number
  cuentaNombre: string
  onClose: () => void
  onImported: () => void
}

export function ImportarExtractoModal({ cuentaId, cuentaNombre, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<{
    formato: string
    total: number
    nuevos: number
    duplicados: number
    totalCreditos?: number
    totalDebitos?: number
    muestra: RowPreview[]
    todos: RowPreview[]
    warnings: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('archivo', f)
      formData.append('cuentaId', cuentaId.toString())
      const res = await fetch('/api/contabilidad/importar-extracto/preview', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al procesar archivo')
        setPreview(null)
      } else {
        setPreview(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview || preview.nuevos === 0) return
    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/contabilidad/importar-extracto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuentaId,
          formato: preview.formato,
          rows: preview.todos.filter(r => !r.duplicado),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al importar')
      } else {
        setSuccessMsg(`✓ ${data.importados} movimientos importados correctamente`)
        setTimeout(() => {
          onImported()
          onClose()
        }, 1200)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setError(null)
    setSuccessMsg(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Importar extracto bancario</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Cuenta: {cuentaNombre}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step 1: Seleccionar archivo */}
          {!preview && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Selecciona un archivo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos soportados: TXT (Banco Popular), CSV genérico, Excel (.xlsx)
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button onClick={() => fileRef.current?.click()} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Elegir archivo
                  </Button>
                  <a
                    href="/api/contabilidad/importar-extracto/plantilla"
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar plantilla CSV
                  </a>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="text-xs text-muted-foreground space-y-1 px-1">
                <p className="font-medium text-foreground">Tips para importar desde tu banco:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><strong>Banco Popular</strong>: descarga el TXT desde portal → Consulta movimientos → Exportar.</li>
                  <li><strong>BHD, Scotiabank, Reservas, Santa Cruz, Banesco</strong>: descarga el Excel o CSV del portal.</li>
                  <li>Si tu banco da un formato raro, descarga la plantilla CSV y pasa los datos a ese formato.</li>
                  <li>El sistema detecta movimientos duplicados automáticamente (por fecha + monto + referencia).</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {preview && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Formato</p>
                  <p className="text-sm font-mono font-semibold mt-1">
                    {preview.formato === 'banco-popular-txt' ? 'Banco Popular' :
                     preview.formato === 'xlsx' ? 'Excel' :
                     preview.formato === 'csv' ? 'CSV' : preview.formato}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Total filas</p>
                  <p className="text-lg font-bold mt-1">{preview.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase">Nuevas</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">{preview.nuevos}</p>
                </div>
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 uppercase">Duplicadas</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-1">{preview.duplicados}</p>
                </div>
              </div>

              {(preview.totalCreditos != null || preview.totalDebitos != null) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <span className="text-muted-foreground">Total créditos nuevos: </span>
                    <span className="font-semibold text-green-600">+{formatCurrency(preview.totalCreditos ?? 0)}</span>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <span className="text-muted-foreground">Total débitos nuevos: </span>
                    <span className="font-semibold text-red-600">-{formatCurrency(preview.totalDebitos ?? 0)}</span>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                      {preview.warnings.map((w, i) => <p key={i}>{w}</p>)}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla preview */}
              {preview.muestra.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b border-border">
                    <p className="text-xs font-medium">Vista previa (primeras {Math.min(20, preview.muestra.length)} filas)</p>
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Fecha</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Tipo</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Descripción</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Ref</th>
                          <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Monto</th>
                          <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preview.muestra.map((r, i) => (
                          <tr key={i} className={r.duplicado ? 'opacity-50' : ''}>
                            <td className="px-2 py-1 whitespace-nowrap">{r.fecha.slice(0, 10)}</td>
                            <td className="px-2 py-1">
                              <span className={r.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}>
                                {r.tipo === 'credito' ? 'CR' : 'DB'}
                              </span>
                            </td>
                            <td className="px-2 py-1 max-w-xs truncate" title={r.descripcion}>{r.descripcion}</td>
                            <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{r.referencia || '—'}</td>
                            <td className={`px-2 py-1 text-right tabular-nums ${r.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(r.monto)}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {r.duplicado
                                ? <span className="text-[10px] text-amber-600">Duplicada</span>
                                : <span className="text-[10px] text-emerald-600">Nueva</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mensajes */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p>{successMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/20">
          <div>
            {file && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {preview && (
              <Button variant="secondary" size="sm" onClick={reset} disabled={importing}>
                Cambiar archivo
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose} disabled={importing}>
              Cancelar
            </Button>
            {preview && preview.nuevos > 0 && !successMsg && (
              <Button size="sm" onClick={handleConfirm} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Importar {preview.nuevos} movimiento{preview.nuevos === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
