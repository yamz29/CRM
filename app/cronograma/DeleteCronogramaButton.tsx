'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  id: number
  nombre: string
  actividadesCount: number
}

export function DeleteCronogramaButton({ id, nombre, actividadesCount }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    const msg = actividadesCount > 0
      ? `¿Eliminar el cronograma "${nombre}"? Se borrarán también sus ${actividadesCount} actividad(es) y avances. Esta acción no se puede deshacer.`
      : `¿Eliminar el cronograma "${nombre}"? Esta acción no se puede deshacer.`
    if (!confirm(msg)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/cronograma/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Error al eliminar el cronograma')
      }
    } catch {
      alert('Error al eliminar el cronograma')
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
      title="Eliminar cronograma"
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </Button>
  )
}
