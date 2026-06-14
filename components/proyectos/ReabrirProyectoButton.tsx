'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Unlock, Loader2 } from 'lucide-react'

interface Props {
  proyectoId: number
  /** Solo se muestra si rol === 'Admin'. La validación final está en backend. */
  esAdmin: boolean
}

export function ReabrirProyectoButton({ proyectoId, esAdmin }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (!esAdmin) return null

  async function reabrir() {
    setEnviando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/reabrir`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'No se pudo reabrir')
        return
      }
      toast.exito('Proyecto reabierto')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setEnviando(false)
      setAbierto(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)} disabled={enviando}>
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
        Reabrir proyecto
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo="¿Reabrir este proyecto?"
        descripcion="Volverá a permitir gastos, facturas, pagos y cambios al cronograma."
        textoConfirmar="Sí, reabrir"
        cargando={enviando}
        onConfirmar={reabrir}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
