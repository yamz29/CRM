'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { X, FileText, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'

interface Presupuesto {
  id: number
  numero: string
  estado: string
  total: number
  createdAt: string
  proyectoId: number | null
  _count?: { capitulos: number }
}

function PresupuestoRow({ p, selected, presupuestoBaseId, onSelect }: {
  p: Presupuesto
  selected: number | null
  presupuestoBaseId: number | null
  onSelect: (id: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(p.id)}
      className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
        selected === p.id
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{p.numero}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            p.estado === 'Aprobado' ? 'bg-green-100 text-green-700'
              : p.estado === 'Enviado' ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}>{p.estado}</span>
          {p.id === presupuestoBaseId && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Base actual</span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{formatDate(p.createdAt)}</div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <div className="text-sm font-bold text-slate-800">{formatCurrency(p.total)}</div>
        <ChevronRight className={`w-4 h-4 ml-auto mt-0.5 transition-opacity ${selected === p.id ? 'text-blue-600 opacity-100' : 'opacity-0'}`} />
      </div>
    </button>
  )
}

export function PoblarPresupuestoModal({
  proyectoId,
  presupuestoBaseId,
  onClose,
  onSuccess,
}: {
  proyectoId: number
  presupuestoBaseId: number | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [reemplazar, setReemplazar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/presupuestos-v2`)
      .then(r => r.json())
      .then(d => {
        const all: Presupuesto[] = Array.isArray(d) ? d : (d.presupuestos ?? [])
        // Own project first, then unlinked, exclude presupuestos linked to OTHER projects
        const list = all.filter(p => p.proyectoId === proyectoId || p.proyectoId == null)
        setPresupuestos(list)
        const aprobado = list.find(p => p.estado === 'Aprobado' && p.proyectoId === proyectoId)
        if (aprobado) setSelected(aprobado.id)
        else if (list.length > 0) setSelected(list[0].id)
      })
      .catch(() => setError('Error al cargar presupuestos'))
      .finally(() => setLoadingList(false))
  }, [proyectoId])

  async function handleImportar() {
    if (!selected) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/poblar-presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: selected, reemplazar }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al importar'); return }
      setSuccess(data.mensaje)
      setTimeout(() => { onSuccess(); onClose() }, 1800)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const selectedPres = presupuestos.find(p => p.id === selected)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Poblar desde presupuesto
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          <p className="text-sm text-slate-600">
            Selecciona un presupuesto del proyecto para copiar su estructura de capítulos y partidas como base de comparación.
            Este proceso <strong>no modifica</strong> el presupuesto original.
          </p>

          {/* Presupuesto list */}
          {loadingList ? (
            <div className="text-sm text-slate-500 text-center py-4">Cargando presupuestos...</div>
          ) : presupuestos.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No hay presupuestos disponibles. Crea uno primero.
            </div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {/* Group: own project */}
              {presupuestos.filter(p => p.proyectoId === proyectoId).length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 pt-1 pb-0.5">De este proyecto</p>
                  {presupuestos.filter(p => p.proyectoId === proyectoId).map(p => (
                    <PresupuestoRow key={p.id} p={p} selected={selected} presupuestoBaseId={presupuestoBaseId} onSelect={setSelected} />
                  ))}
                </>
              )}
              {/* Group: unlinked */}
              {presupuestos.filter(p => p.proyectoId == null).length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 pt-2 pb-0.5">Sin proyecto asignado</p>
                  {presupuestos.filter(p => p.proyectoId == null).map(p => (
                    <PresupuestoRow key={p.id} p={p} selected={selected} presupuestoBaseId={presupuestoBaseId} onSelect={setSelected} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Options */}
          {presupuestoBaseId && (
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-amber-50 border border-amber-200">
              <input
                type="checkbox"
                checked={reemplazar}
                onChange={e => setReemplazar(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-amber-800">Reemplazar estructura existente</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Ya existe una base cargada. Activar esta opción borrará los capítulos y partidas actuales
                  del proyecto (los gastos se conservan, pero perderán su asignación a partida).
                </p>
              </div>
            </label>
          )}

          {/* Preview */}
          {selectedPres && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
              <p><span className="font-semibold">Presupuesto seleccionado:</span> {selectedPres.numero}</p>
              <p><span className="font-semibold">Total presupuestado:</span> {formatCurrency(selectedPres.total)}</p>
              <p><span className="font-semibold">Estado:</span> {selectedPres.estado}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <Button
            onClick={handleImportar}
            disabled={!selected || loading || (!!presupuestoBaseId && !reemplazar && selected === presupuestoBaseId) || !!success}
            size="sm"
          >
            {loading ? 'Importando...' : 'Importar estructura'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
