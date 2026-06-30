'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Loader2, Copy } from 'lucide-react'

export function DuplicarButton({
  presupuestoId,
  nPartidas,
  nCapitulos,
}: {
  presupuestoId: number
  nPartidas: number
  nCapitulos: number
}) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const duplicar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presupuestos-v2/${presupuestoId}/duplicar`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'No se pudo duplicar el presupuesto')
        setLoading(false)
        setAbierto(false)
        return
      }
      const { id } = await res.json()
      toast.exito('Presupuesto duplicado como Borrador')
      router.push(`/presupuestos/${id}`)
    } catch {
      toast.error('Error de conexión al duplicar el presupuesto')
      setLoading(false)
      setAbierto(false)
    }
  }

  const alcance = `${nPartidas} partida${nPartidas === 1 ? '' : 's'} en ${nCapitulos} capítulo${nCapitulos === 1 ? '' : 's'}`

  return (
    <>
      <Button variant="secondary" onClick={() => setAbierto(true)} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
        Duplicar
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo="¿Duplicar este presupuesto?"
        descripcion={`Se copiará completo (${alcance}, con APUs e indirectos). El nuevo presupuesto se creará como Borrador con un número nuevo.`}
        textoConfirmar="Sí, duplicar"
        variante="primario"
        cargando={loading}
        onConfirmar={duplicar}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
