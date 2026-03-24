'use client'

import { useState, useEffect } from 'react'
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface HistoryEntry {
  id: number
  precioAnterior: number
  precioNuevo: number
  moneda: string
  unidadSnapshot: string
  origenCambio: string
  observacion: string | null
  createdAt: string
  loteImportacion: { id: number; nombreArchivo: string } | null
}

interface Props {
  recursoId: number
}

function fmt(n: number) {
  return `RD$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function PriceHistoryPanel({ recursoId }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/recursos/${recursoId}/historial`)
      .then(r => r.json())
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [recursoId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm text-slate-400">Cargando historial...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">Historial de precios</h3>
        {entries.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">{entries.length} cambio{entries.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">Sin cambios de precio registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left font-semibold text-slate-500">Fecha</th>
                <th className="pb-2 text-right font-semibold text-slate-500">Anterior</th>
                <th className="pb-2 text-center font-semibold text-slate-500 w-6"></th>
                <th className="pb-2 text-right font-semibold text-slate-500">Nuevo</th>
                <th className="pb-2 text-right font-semibold text-slate-500">Variación</th>
                <th className="pb-2 text-left font-semibold text-slate-500 pl-4">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {entries.map(e => {
                const diff = e.precioNuevo - e.precioAnterior
                const pct = e.precioAnterior > 0 ? ((diff / e.precioAnterior) * 100) : 0
                const isUp   = diff > 0
                const isDown = diff < 0
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2 text-slate-500 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                    <td className="py-2 text-right font-mono text-slate-600">{fmt(e.precioAnterior)}</td>
                    <td className="py-2 text-center">
                      {isUp   && <TrendingUp   className="w-3 h-3 text-red-400 inline" />}
                      {isDown && <TrendingDown  className="w-3 h-3 text-green-500 inline" />}
                      {!isUp && !isDown && <Minus className="w-3 h-3 text-slate-300 inline" />}
                    </td>
                    <td className="py-2 text-right font-mono font-semibold text-slate-800">{fmt(e.precioNuevo)}</td>
                    <td className={`py-2 text-right font-semibold whitespace-nowrap ${isUp ? 'text-red-500' : isDown ? 'text-green-600' : 'text-slate-400'}`}>
                      {isUp ? '+' : ''}{pct.toFixed(1)}%
                    </td>
                    <td className="py-2 pl-4 text-slate-400">
                      {e.origenCambio === 'importacion' && e.loteImportacion
                        ? <span title={e.loteImportacion.nombreArchivo}>Excel #{e.loteImportacion.id}</span>
                        : <span>Manual</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
