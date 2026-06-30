'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteApuButton({ id, nombre }: { id: number; nombre: string }) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/apus/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.exito(`APU "${nombre}" eliminado`)
        router.refresh()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Error al eliminar el APU')
      }
    } catch {
      toast.error('Error al eliminar el APU')
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
        title={`Eliminar ${nombre}`}
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Eliminar el APU "${nombre}"?`}
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
