'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Copy } from 'lucide-react'

export function DuplicarButton({ presupuestoId }: { presupuestoId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const duplicar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presupuestos-v2/${presupuestoId}/duplicar`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const { id } = await res.json()
      router.push(`/presupuestos/${id}`)
    } catch {
      alert('Error al duplicar el presupuesto')
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" onClick={duplicar} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
      Duplicar
    </Button>
  )
}
