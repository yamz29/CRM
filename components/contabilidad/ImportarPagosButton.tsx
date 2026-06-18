'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import {
  Upload, X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'

interface FilaPreview {
  numFila: number
  facturaId: number | null
  facturaNumero: string | null
  clienteId: number | null
  clienteNombre: string | null
  fecha: string | null
  monto: number
  metodoPago: string
  cuentaBancariaId: number | null
  cuentaNombre: string | null
  referencia: string | null
  observaciones: string | null
  saldoPendiente: number | null
  errores: string[]
}

interface PreviewData {
  filas: FilaPreview[]
  totales: { total: number; ok: number; conErrores: number; montoOk: number }
}

/**
 * Botón "Importar pagos" — modal multi-paso para registrar un lote de cobros
 * desde Excel:  descargar plantilla → subir → preview validado → confirmar.
 * Las filas con error se omiten; se registran solo las válidas.
 */
export function ImportarPagosButton() {
  const router = useRouter()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [cargando, setCargando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setArchivo(null)
    setPreview(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function cerrar() {
    if (importando || cargando) return
    setOpen(false)
    setTimeout(reset, 150)
  }

  async function handleArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    setError(null)
    setPreview(null)
    setCargando(true)
    try {
      const formData = new FormData()
      formData.append('archivo', file)
      const res = await fetch('/api/cobros/pagos/importar/preview', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'No se pudo procesar el archivo'); return }
      setPreview(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setCargando(false)
    }
  }

  async function importar() {
    if (!preview) return
    const filasOk = preview.filas.filter(f => f.errores.length === 0)
    if (filasOk.length === 0) { setError('No hay filas válidas para importar'); return }
    setImportando(true); setError(null)
    try {
      const res = await fetch('/api/cobros/pagos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filas: filasOk.map(f => ({
            facturaId: f.facturaId,
            clienteId: f.clienteId,
            fecha: f.fecha,
            monto: f.monto,
            metodoPago: f.metodoPago,
            cuentaBancariaId: f.cuentaBancariaId,
            referencia: f.referencia,
            observaciones: f.observaciones,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'No se pudo importar'); return }
      toast.exito(`${data.recibosCreados} recibo(s) registrado(s) en ${data.facturasActualizadas} factura(s)`)
      router.refresh()
      setOpen(false)
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setImportando(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="w-4 h-4" /> Importar pagos
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={cerrar}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Importar lote de pagos</h2>
              </div>
              <button onClick={cerrar} disabled={importando || cargando} className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!preview && (
                <>
                  <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-3">
                    <div>
                      <p className="font-semibold text-foreground text-sm">1. Descarga la plantilla</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trae tus facturas pendientes con el saldo. Llena <span className="font-medium">monto_pago</span> (y opcionalmente fecha, método, cuenta) y vuelve a subir el archivo.
                      </p>
                    </div>
                    <a href="/api/export/cobros/plantilla" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                      <Download className="w-4 h-4" /> Descargar plantilla de cobros.xlsx
                    </a>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground text-sm mb-2">2. Sube tu archivo</p>
                    <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">{cargando ? 'Procesando…' : 'Click para subir Excel'}</p>
                      <p className="text-xs text-muted-foreground mt-1">.xlsx o .csv, máx 5 MB</p>
                      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleArchivoChange} disabled={cargando} className="hidden" />
                    </label>
                    {archivo && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Archivo: <span className="font-medium text-foreground">{archivo.name}</span>
                      </p>
                    )}
                  </div>
                </>
              )}

              {preview && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-card border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Total filas</p>
                      <p className="text-2xl font-black text-foreground tabular-nums">{preview.totales.total}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="text-xs text-green-700 dark:text-green-400">Listas para registrar</p>
                      <p className="text-2xl font-black text-green-700 dark:text-green-400 tabular-nums">{preview.totales.ok}</p>
                      <p className="text-[10px] text-green-700 dark:text-green-400 tabular-nums mt-0.5">{formatCurrency(preview.totales.montoOk)}</p>
                    </div>
                    <div className={`border rounded-lg p-3 ${preview.totales.conErrores > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-muted/20 border-border'}`}>
                      <p className={`text-xs ${preview.totales.conErrores > 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>Con errores</p>
                      <p className={`text-2xl font-black tabular-nums ${preview.totales.conErrores > 0 ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{preview.totales.conErrores}</p>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-left">
                          <th className="px-2 py-2 font-semibold w-10">#</th>
                          <th className="px-2 py-2 font-semibold w-8"></th>
                          <th className="px-2 py-2 font-semibold w-28">Factura</th>
                          <th className="px-2 py-2 font-semibold">Cliente</th>
                          <th className="px-2 py-2 font-semibold w-24">Fecha</th>
                          <th className="px-2 py-2 font-semibold text-right w-24">Monto</th>
                          <th className="px-2 py-2 font-semibold text-right w-24">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preview.filas.map(f => {
                          const tieneError = f.errores.length > 0
                          return (
                            <tr key={f.numFila} className={tieneError ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                              <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{f.numFila}</td>
                              <td className="px-2 py-1.5">
                                {tieneError ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                              </td>
                              <td className="px-2 py-1.5">
                                <p className="font-medium text-foreground">{f.facturaNumero ?? <span className="text-red-500 italic">—</span>}</p>
                                {tieneError && (
                                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 italic">{f.errores.join(' · ')}</p>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground truncate">{f.clienteNombre ?? '—'}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{f.fecha ? formatDate(f.fecha) : <span className="text-red-500">—</span>}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums font-medium text-foreground">{formatCurrency(f.monto)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{f.saldoPendiente != null ? formatCurrency(f.saldoPendiente) : '—'}</td>
                            </tr>
                          )
                        })}
                        {preview.filas.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">El archivo no contiene filas con datos.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {preview.totales.conErrores > 0 && preview.totales.ok > 0 && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                      ⚠ Las filas con error <strong>se omiten</strong>. Si quieres incluirlas, corrige el Excel y vuelve a importar.
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">{error}</div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              {preview && (
                <Button variant="ghost" size="sm" onClick={reset} disabled={importando}>Cargar otro archivo</Button>
              )}
              <Button variant="ghost" size="sm" onClick={cerrar} disabled={importando}>Cancelar</Button>
              {preview && preview.totales.ok > 0 && (
                <Button size="sm" onClick={importar} disabled={importando}>
                  {importando
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Registrando…</>
                    : <>Registrar {preview.totales.ok} recibo{preview.totales.ok !== 1 ? 's' : ''}</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
