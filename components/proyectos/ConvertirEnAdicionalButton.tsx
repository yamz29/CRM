'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { X, FilePlus, Loader2 } from 'lucide-react'

interface Props {
  proyectoId: number
  presupuesto: {
    id: number
    numero: string
    total: number
    estado: string
  }
}

/**
 * Botón pequeño que aparece en la fila de cada presupuesto del proyecto.
 * Al click abre un mini-modal donde el usuario elige el estado del adicional
 * (propuesto / aprobado) y confirma. Útil para registrar como Adicional un
 * presupuesto que se hizo aparte para cubrir cambios de alcance.
 */
export function ConvertirEnAdicionalButton({ proyectoId, presupuesto }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [estado, setEstado] = useState<'propuesto' | 'aprobado'>('propuesto')
  const [enviando, setEnviando] = useState(false)

  async function convertir() {
    setEnviando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/adicionales/desde-presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: presupuesto.id, estado }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'No se pudo convertir')
        return
      }
      router.refresh()
      setOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Crear un adicional del proyecto a partir de este presupuesto"
      >
        <FilePlus className="w-3.5 h-3.5" /> Adicional
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !enviando && setOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Convertir en adicional</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={enviando}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Presupuesto origen</p>
                <p className="font-semibold text-foreground">{presupuesto.numero}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estado: {presupuesto.estado} · Monto: <strong className="text-foreground">{formatCurrency(presupuesto.total)}</strong>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Estado del adicional
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'propuesto', label: 'Propuesto', hint: 'Aún no firmado por el cliente' },
                    { value: 'aprobado', label: 'Aprobado', hint: 'Ya firmado / autorizado' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEstado(opt.value)}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                        estado === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2.5">
                Se creará un Adicional con monto <strong className="text-foreground">{formatCurrency(presupuesto.total)}</strong>.
                Aparecerá en la pestaña <strong className="text-foreground">Adicionales</strong> y, si está aprobado,
                sumará al presupuesto vigente del control.
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button size="sm" onClick={convertir} disabled={enviando}>
                {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
                Crear adicional
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
