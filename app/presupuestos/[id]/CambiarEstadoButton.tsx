'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Loader2, Send, CheckCircle, XCircle, FileEdit } from 'lucide-react'

interface CambiarEstadoButtonProps {
  presupuestoId: number
  estadoActual: string
  /** Nombre del proyecto vinculado, para avisar del efecto secundario al aprobar */
  nombreProyecto?: string | null
}

export function CambiarEstadoButton({ presupuestoId, estadoActual, nombreProyecto }: CambiarEstadoButtonProps) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<'Aprobado' | 'Rechazado' | null>(null)

  const cambiarEstado = async (nuevoEstado: string) => {
    setLoading(nuevoEstado)
    try {
      const response = await fetch(`/api/presupuestos/${presupuestoId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (response.ok) {
        toast.exito(`Presupuesto marcado como ${nuevoEstado}`)
        router.refresh()
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo cambiar el estado del presupuesto')
      }
    } catch {
      toast.error('Error de conexión al cambiar el estado')
    } finally {
      setLoading(null)
      setConfirmando(null)
    }
  }

  return (
    <>
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
            color="success"
            onClick={() => setConfirmando('Aprobado')}
            disabled={!!loading}
          >
            {loading === 'Aprobado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Aprobar
          </Button>
        )}
        {estadoActual !== 'Rechazado' && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmando('Rechazado')}
            disabled={!!loading}
          >
            {loading === 'Rechazado' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Rechazar
          </Button>
        )}
      </div>

      <ConfirmDialog
        abierto={confirmando === 'Aprobado'}
        titulo="¿Aprobar este presupuesto?"
        descripcion={
          nombreProyecto
            ? `Al aprobar, el proyecto "${nombreProyecto}" pasará automáticamente a "En Ejecución".`
            : 'El presupuesto quedará marcado como aprobado por el cliente.'
        }
        textoConfirmar="Sí, aprobar"
        cargando={loading === 'Aprobado'}
        onConfirmar={() => cambiarEstado('Aprobado')}
        onCancelar={() => setConfirmando(null)}
      />

      <ConfirmDialog
        abierto={confirmando === 'Rechazado'}
        titulo="¿Rechazar este presupuesto?"
        descripcion="Podrás volver a ponerlo en Borrador más adelante si el cliente cambia de opinión."
        textoConfirmar="Sí, rechazar"
        variante="peligro"
        cargando={loading === 'Rechazado'}
        onConfirmar={() => cambiarEstado('Rechazado')}
        onCancelar={() => setConfirmando(null)}
      />
    </>
  )
}
