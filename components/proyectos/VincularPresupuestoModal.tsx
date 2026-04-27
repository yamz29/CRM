'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { X, FileText, AlertTriangle, Link2, Loader2 } from 'lucide-react'

interface PresupuestoVinculable {
  id: number
  numero: string
  total: number
  estado: string
  createdAt: string
  enOtroProyecto: boolean
  proyectoActualNombre: string | null
}

interface Props {
  proyectoId: number
  open: boolean
  onClose: () => void
}

export function VincularPresupuestoModal({ proyectoId, open, onClose }: Props) {
  const router = useRouter()
  const [presupuestos, setPresupuestos] = useState<PresupuestoVinculable[]>([])
  const [loading, setLoading] = useState(false)
  const [vinculando, setVinculando] = useState<number | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'sin-proyecto' | 'con-otro'>('todos')

  const fetchPresupuestos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/presupuestos-vinculables`)
      if (res.ok) {
        setPresupuestos(await res.json())
      } else {
        setPresupuestos([])
      }
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => {
    if (open) fetchPresupuestos()
  }, [open, fetchPresupuestos])

  async function vincular(p: PresupuestoVinculable) {
    if (p.enOtroProyecto) {
      const ok = confirm(
        `Este presupuesto está vinculado a "${p.proyectoActualNombre}".\n\n` +
        `Si continúas, el vínculo cambia a este proyecto y dejará de aparecer en el otro.\n\n` +
        `¿Confirmas?`
      )
      if (!ok) return
    }

    setVinculando(p.id)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/vincular-presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: p.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'No se pudo vincular el presupuesto')
        return
      }
      router.refresh()
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setVinculando(null)
    }
  }

  if (!open) return null

  const filtrados = presupuestos.filter(p => {
    if (filtroEstado === 'sin-proyecto') return !p.enOtroProyecto
    if (filtroEstado === 'con-otro') return p.enOtroProyecto
    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Vincular presupuesto existente</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Mostrar:</span>
          {([
            { value: 'todos', label: `Todos (${presupuestos.length})` },
            { value: 'sin-proyecto', label: `Sin proyecto (${presupuestos.filter(p => !p.enOtroProyecto).length})` },
            { value: 'con-otro', label: `En otro proyecto (${presupuestos.filter(p => p.enOtroProyecto).length})` },
          ] as const).map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroEstado(f.value)}
              className={`px-2 py-1 rounded transition-colors ${
                filtroEstado === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border border-border hover:bg-muted/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando presupuestos…
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">
                {presupuestos.length === 0
                  ? 'No hay presupuestos del cliente para vincular.'
                  : 'No hay presupuestos que coincidan con el filtro.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(p => {
                const isVinc = vinculando === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isVinc}
                    onClick={() => vincular(p)}
                    className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                      isVinc
                        ? 'border-primary bg-primary/5 cursor-wait'
                        : 'border-border hover:border-primary/50 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{p.numero}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.estado === 'Aprobado' ? 'bg-green-100 text-green-700'
                            : p.estado === 'Enviado' ? 'bg-blue-100 text-blue-700'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {p.estado}
                        </span>
                        {p.enOtroProyecto && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            En: {p.proyectoActualNombre}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span>{formatDate(p.createdAt)}</span>
                        <span className="font-bold text-foreground">{formatCurrency(p.total)}</span>
                      </div>
                    </div>
                    {isVinc ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

/** Botón con estado interno que abre el modal. Pensado para incrustar
 *  dentro de la pestaña "Presupuestos" del proyecto. */
export function VincularPresupuestoButton({ proyectoId }: { proyectoId: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Link2 className="w-3.5 h-3.5" /> Vincular existente
      </Button>
      <VincularPresupuestoModal proyectoId={proyectoId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
