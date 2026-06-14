'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  id: number
  nombre: string
  actividadesCount: number
}

export function DeleteCronogramaButton({ id, nombre, actividadesCount }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const descripcion = actividadesCount > 0
    ? `Se borrarán también sus ${actividadesCount} actividad(es) y avances. Esta acción no se puede deshacer.`
    : 'Esta acción no se puede deshacer.'

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.exito(`Cronograma "${nombre}" eliminado`)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Error al eliminar el cronograma')
      }
    } catch {
      toast.error('Error al eliminar el cronograma')
    } finally {
      setLoading(false)
      setAbierto(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAbierto(true)}
        disabled={loading}
        title="Eliminar cronograma"
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Eliminar el cronograma "${nombre}"?`}
        descripcion={descripcion}
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={loading}
        onConfirmar={handleDelete}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
