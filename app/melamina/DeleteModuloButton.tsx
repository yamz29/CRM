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
}

export function DeleteModuloButton({ id, nombre }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/melamina/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.exito(`Módulo "${nombre}" eliminado`)
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Error al eliminar el módulo')
      }
    } catch {
      toast.error('Error al eliminar el módulo')
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
        title={`Eliminar módulo: ${nombre}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Eliminar el módulo "${nombre}"?`}
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
