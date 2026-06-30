'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  id: number
  titulo: string
}

export function DeleteTareaButton({ id, titulo }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.exito(`Tarea "${titulo}" eliminada`)
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Error al eliminar la tarea')
      }
    } catch {
      toast.error('Error al eliminar la tarea')
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
        title={`Eliminar tarea: ${titulo}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Eliminar la tarea "${titulo}"?`}
        descripcion="Esta acción no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={loading}
        onConfirmar={handleDelete}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
