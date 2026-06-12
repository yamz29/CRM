'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Loader2, Copy } from 'lucide-react'

export function DuplicarButton({ presupuestoId }: { presupuestoId: number }) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const duplicar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presupuestos-v2/${presupuestoId}/duplicar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo duplicar el presupuesto')
        setLoading(false)
        return
      }
      const { id } = await res.json()
      toast.exito('Presupuesto duplicado como Borrador')
      router.push(`/presupuestos/${id}`)
    } catch {
      toast.error('Error de conexión al duplicar el presupuesto')
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
