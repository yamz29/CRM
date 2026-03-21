'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'

interface DeleteProyectoButtonProps {
  id: number
  nombre: string
}

export function DeleteProyectoButton({ id, nombre }: DeleteProyectoButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`¿Está seguro de eliminar el proyecto "${nombre}"? Esta acción no se puede deshacer.`)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/proyectos/${id}`, { method: 'DELETE' })
      if (response.ok) {
        router.refresh()
      } else {
        alert('Error al eliminar el proyecto')
      }
    } catch {
      alert('Error al eliminar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
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
  )
}
