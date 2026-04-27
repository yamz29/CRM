'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { X, AlertTriangle, AlertOctagon, Loader2, Lock } from 'lucide-react'

interface Check {
  codigo: string
  mensaje: string
  detalle?: string
  cantidad?: number
}

interface CierreChecksResponse {
  yaCerrado: boolean
  bloqueantes: Check[]
  advertencias: Check[]
  resumen?: {
    totalCobrado: number
    totalGastos: number
    margenBruto: number
    saldoIngresoPendiente: number
    saldoEgresoPendiente: number
    avanceFisico: number
  }
}

interface Props {
  proyectoId: number
  open: boolean
  onClose: () => void
}

export function CerrarProyectoModal({ proyectoId, open, onClose }: Props) {
  const router = useRouter()
  const [data, setData] = useState<CierreChecksResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [confirmAdvertencias, setConfirmAdvertencias] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChecks = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/cierre-checks`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
      else setError('No se pudieron cargar las validaciones')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => {
    if (open) {
      fetchChecks()
      setObservaciones('')
      setConfirmAdvertencias(false)
      setError(null)
    }
  }, [open, fetchChecks])

  if (!open) return null

  const tieneBloqueantes = (data?.bloqueantes.length ?? 0) > 0
  const tieneAdvertencias = (data?.advertencias.length ?? 0) > 0
  const puedeCerrar = !!data && !tieneBloqueantes && (!tieneAdvertencias || confirmAdvertencias)

  async function cerrar() {
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observaciones: observaciones.trim() || undefined,
          forzarConAdvertencias: tieneAdvertencias,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || 'No se pudo cerrar el proyecto')
        return
      }
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !enviando && onClose()}>
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Cerrar proyecto</h2>
          </div>
          <button onClick={onClose} disabled={enviando} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Validando pendientes…
            </div>
          )}

          {!loading && data && (
            <>
              {/* Resumen financiero */}
              {data.resumen && (
                <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground mb-2">Resumen</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">Cobrado:</span>
                    <span className="font-mono text-right">{formatCurrency(data.resumen.totalCobrado)}</span>
                    <span className="text-muted-foreground">Gastado:</span>
                    <span className="font-mono text-right">{formatCurrency(data.resumen.totalGastos)}</span>
                    <span className="text-muted-foreground">Margen bruto:</span>
                    <span className={`font-mono text-right font-semibold ${data.resumen.margenBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(data.resumen.margenBruto)}
                    </span>
                    <span className="text-muted-foreground">Avance físico:</span>
                    <span className="font-mono text-right">{data.resumen.avanceFisico}%</span>
                  </div>
                </div>
              )}

              {/* Bloqueantes */}
              {tieneBloqueantes && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5 mb-2">
                    <AlertOctagon className="w-4 h-4" />
                    No se puede cerrar — resuelve primero:
                  </h3>
                  <ul className="space-y-2">
                    {data.bloqueantes.map(b => (
                      <li key={b.codigo} className="border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg px-3 py-2">
                        <p className="text-sm font-medium text-red-900 dark:text-red-200">{b.mensaje}</p>
                        {b.detalle && <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{b.detalle}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Advertencias */}
              {tieneAdvertencias && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Advertencias (puedes cerrar igual):
                  </h3>
                  <ul className="space-y-2">
                    {data.advertencias.map(a => (
                      <li key={a.codigo} className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg px-3 py-2">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{a.mensaje}</p>
                        {a.detalle && <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{a.detalle}</p>}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 mt-3 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmAdvertencias}
                      onChange={e => setConfirmAdvertencias(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>Entiendo las advertencias y quiero cerrar el proyecto igualmente.</span>
                  </label>
                </div>
              )}

              {!tieneBloqueantes && !tieneAdvertencias && (
                <div className="border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-lg px-3 py-2 text-sm text-green-800 dark:text-green-300">
                  ✓ Todo en orden. El proyecto puede cerrarse limpio.
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Observaciones de cierre <span className="text-muted-foreground font-normal">(opcional, aparece en el informe)</span>
                </label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Ej: cliente quedó satisfecho, hubo retrasos por lluvia en marzo, presupuesto se ajustó por cambio de acabados…"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background resize-y"
                />
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2.5">
                <strong>⚠ Cerrar es definitivo</strong> — después no podrás registrar gastos, facturas, pagos
                ni adicionales sin que un administrador reabra el proyecto.
              </div>
            </>
          )}

          {error && (
            <div className="border border-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button
            size="sm"
            onClick={cerrar}
            disabled={!puedeCerrar || enviando}
            className="bg-slate-800 hover:bg-slate-900 text-white disabled:bg-slate-300"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Cerrar proyecto
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Botón con estado interno que abre el modal de cierre. */
export function CerrarProyectoButton({ proyectoId }: { proyectoId: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Lock className="w-4 h-4" /> Cerrar proyecto
      </Button>
      <CerrarProyectoModal proyectoId={proyectoId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
