'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Unlock, Loader2 } from 'lucide-react'

interface Props {
  proyectoId: number
  /** Solo se muestra si rol === 'Admin'. La validación final está en backend. */
  esAdmin: boolean
}

export function ReabrirProyectoButton({ proyectoId, esAdmin }: Props) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)

  if (!esAdmin) return null

  async function reabrir() {
    if (!confirm('¿Reabrir este proyecto? Volverá a permitir gastos, facturas, pagos y cambios al cronograma.')) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/reabrir`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'No se pudo reabrir')
        return
      }
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Button variant="outline" onClick={reabrir} disabled={enviando}>
      {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
      Reabrir proyecto
    </Button>
  )
}
