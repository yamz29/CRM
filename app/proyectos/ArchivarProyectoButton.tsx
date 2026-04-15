'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Archive, ArchiveRestore, Loader2 } from 'lucide-react'

interface Props {
  id: number
  nombre: string
  archivada: boolean
}

export function ArchivarProyectoButton({ id, nombre, archivada }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const nuevoEstado = !archivada
    const accion = nuevoEstado ? 'archivar' : 'desarchivar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el proyecto "${nombre}"?`)) {
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _archivar: nuevoEstado }),
      })
      if (res.ok) {
        if (nuevoEstado) {
          // Al archivar: volver al listado
          router.push('/proyectos')
        } else {
          router.refresh()
        }
      } else {
        alert(`Error al ${accion} el proyecto`)
      }
    } catch {
      alert(`Error al ${accion} el proyecto`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
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
  )
}
