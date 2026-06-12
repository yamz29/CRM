'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Trash2, Loader2 } from 'lucide-react'

interface DeletePresupuestoButtonProps {
  id: number
  numero: string
}

export function DeletePresupuestoButton({ id, numero }: DeletePresupuestoButtonProps) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.exito(`Presupuesto ${numero} eliminado`)
        router.refresh()
      } else {
        const data = await response.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo eliminar el presupuesto')
      }
    } catch {
      toast.error('Error de conexión al eliminar el presupuesto')
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
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿Eliminar el presupuesto ${numero}?`}
        descripcion="Esta acción no se puede deshacer. Se eliminarán también sus capítulos, partidas y APUs."
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={loading}
        onConfirmar={handleDelete}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
