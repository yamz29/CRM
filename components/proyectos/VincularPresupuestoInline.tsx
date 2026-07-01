'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { VincularPresupuestoModal } from './VincularPresupuestoModal'
import { formatCurrency } from '@/lib/utils'
import { Link2, Loader2, ChevronDown } from 'lucide-react'

interface Vinculable {
  id: number
  numero: string
  total: number
  estado: string
  enOtroProyecto: boolean
  clienteCoincide: boolean
}

/**
 * Vinculación de presupuesto inline (#H22). Para los casos sin conflicto
 * (sin proyecto + mismo cliente) permite vincular en 1 clic desde un
 * desplegable. Los casos con conflicto (en otro proyecto / otro cliente)
 * abren el modal completo, que conserva sus confirmaciones de seguridad.
 */
export function VincularPresupuestoInline({ proyectoId }: { proyectoId: number }) {
  const router = useRouter()
  const toast = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [opts, setOpts] = useState<Vinculable[]>([])
  const [loaded, setLoaded] = useState(false)
  const [vinculando, setVinculando] = useState<number | null>(null)

  const fetchOpts = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/presupuestos-vinculables`, { cache: 'no-store' })
      if (res.ok) setOpts(await res.json())
    } finally {
      setLoaded(true)
    }
  }, [proyectoId])

  useEffect(() => {
    if (open && !loaded) fetchOpts()
  }, [open, loaded, fetchOpts])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const rapidos = opts.filter(o => !o.enOtroProyecto && o.clienteCoincide)

  async function vincular(id: number) {
    setVinculando(id)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/vincular-presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: id, forzarClienteDistinto: false, actualizarClientePresupuesto: false }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'No se pudo vincular el presupuesto')
        return
      }
      toast.exito('Presupuesto vinculado')
      router.refresh()
      setOpen(false)
    } catch {
      toast.error('Error de conexión al vincular')
    } finally {
      setVinculando(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Link2 className="w-3.5 h-3.5" /> Vincular
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {!loaded ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : rapidos.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">
                No hay presupuestos sin proyecto de este cliente para vincular directo.
              </p>
            ) : (
              rapidos.map(o => (
                <button
                  key={o.id}
                  role="menuitem"
                  disabled={vinculando != null}
                  onClick={() => vincular(o.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{o.numero}</span>
                    <span className="block text-xs text-muted-foreground">{o.estado}</span>
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                    {vinculando === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : formatCurrency(o.total)}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => { setModalOpen(true); setOpen(false) }}
              className="w-full px-4 py-2.5 text-left text-xs font-medium text-primary hover:bg-muted/40 transition-colors"
            >
              Más opciones (otro proyecto u otro cliente)…
            </button>
          </div>
        </div>
      )}

      <VincularPresupuestoModal proyectoId={proyectoId} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
