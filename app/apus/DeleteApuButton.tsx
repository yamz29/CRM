'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteApuButton({ id, nombre }: { id: number; nombre: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    const res = await fetch(`/api/apus/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={handleDelete} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Sí</button>
        <button onClick={() => setConfirming(false)} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200">No</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
      title={`Eliminar ${nombre}`}>
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
