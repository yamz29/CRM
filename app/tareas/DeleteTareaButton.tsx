'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface Props {
  id: number
  titulo: string
}

export function DeleteTareaButton({ id, titulo }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Error al eliminar')
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 max-w-28 truncate">¿Eliminar?</span>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? '...' : 'Sí'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          No
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setConfirming(true)}
      title={`Eliminar tarea: ${titulo}`}
    >
      <Trash2 className="w-4 h-4 text-red-500" />
    </Button>
  )
}
