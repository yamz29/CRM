'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { Archive, ArchiveRestore, Loader2 } from 'lucide-react'

interface Props {
  id: number
  nombre: string
  archivada: boolean
}

export function ArchivarProyectoButton({ id, nombre, archivada }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)

  const nuevoEstado = !archivada
  const accion = nuevoEstado ? 'archivar' : 'desarchivar'

  async function handleConfirmar() {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _archivar: nuevoEstado }),
      })
      if (res.ok) {
        toast.exito(nuevoEstado ? `Proyecto "${nombre}" archivado` : `Proyecto "${nombre}" desarchivado`)
        if (nuevoEstado) {
          // Al archivar: volver al listado
          router.push('/proyectos')
        } else {
          router.refresh()
        }
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? `Error al ${accion} el proyecto`)
      }
    } catch {
      toast.error(`Error al ${accion} el proyecto`)
    } finally {
      setLoading(false)
      setAbierto(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setAbierto(true)}
        disabled={loading}
        className={archivada ? 'text-amber-600 dark:text-amber-400' : ''}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : archivada ? (
          <>
            <ArchiveRestore className="w-4 h-4" /> Desarchivar
          </>
        ) : (
          <>
            <Archive className="w-4 h-4" /> Archivar
          </>
        )}
      </Button>

      <ConfirmDialog
        abierto={abierto}
        titulo={`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el proyecto "${nombre}"?`}
        textoConfirmar={nuevoEstado ? 'Sí, archivar' : 'Sí, desarchivar'}
        cargando={loading}
        onConfirmar={handleConfirmar}
        onCancelar={() => setAbierto(false)}
      />
    </>
  )
}
