'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

interface DeleteProyectoButtonProps {
  id: number
  nombre: string
}

export function DeleteProyectoButton({ id, nombre }: DeleteProyectoButtonProps) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/proyectos/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.exito(`Proyecto "${nombre}" eliminado`)
        router.refresh()
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error ?? 'Error al eliminar el proyecto')
      }
    } catch {
      toast.error('Error al eliminar el proyecto')
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
        title="Eliminar"
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Está seguro de eliminar el proyecto "${nombre}"?`}
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
