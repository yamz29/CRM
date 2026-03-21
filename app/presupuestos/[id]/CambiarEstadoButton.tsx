'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Send, CheckCircle, XCircle, FileEdit } from 'lucide-react'

interface CambiarEstadoButtonProps {
  presupuestoId: number
  estadoActual: string
}

export function CambiarEstadoButton({ presupuestoId, estadoActual }: CambiarEstadoButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const cambiarEstado = async (nuevoEstado: string) => {
    setLoading(nuevoEstado)
    try {
      const response = await fetch(`/api/presupuestos/${presupuestoId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (response.ok) {
        router.refresh()
      }
    } catch {
      alert('Error al cambiar el estado')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {estadoActual !== 'Borrador' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => cambiarEstado('Borrador')}
          disabled={!!loading}
        >
          {loading === 'Borrador' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileEdit className="w-3.5 h-3.5" />}
          Volver a Borrador
        </Button>
      )}
      {estadoActual !== 'Enviado' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => cambiarEstado('Enviado')}
          disabled={!!loading}
          className="border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          {loading === 'Enviado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Marcar como Enviado
        </Button>
      )}
      {estadoActual !== 'Aprobado' && (
        <Button
          size="sm"
          onClick={() => cambiarEstado('Aprobado')}
          disabled={!!loading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {loading === 'Aprobado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Aprobar
        </Button>
      )}
      {estadoActual !== 'Rechazado' && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => cambiarEstado('Rechazado')}
          disabled={!!loading}
        >
          {loading === 'Rechazado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          Rechazar
        </Button>
      )}
    </div>
  )
}
