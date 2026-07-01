'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

interface PresupuestoCard {
  id: number
  numero: string
  total: number
  estado: string
  cliente: { nombre: string } | null
  proyecto: { id: number; nombre: string } | null
}

const COLUMNAS = [
  { key: 'Borrador',  label: 'Borrador',  dot: 'bg-slate-400' },
  { key: 'Enviado',   label: 'Enviado',   dot: 'bg-blue-500' },
  { key: 'Aprobado',  label: 'Aprobado',  dot: 'bg-green-500' },
  { key: 'Rechazado', label: 'Rechazado', dot: 'bg-red-500' },
] as const

export function PresupuestosKanban({ presupuestos: initial }: { presupuestos: PresupuestoCard[] }) {
  const router = useRouter()
  const toast = useToast()
  const [items, setItems] = useState(initial)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [aprobar, setAprobar] = useState<PresupuestoCard | null>(null)
  const [aplicando, setAplicando] = useState(false)

  const porColumna = useMemo(() => {
    const map: Record<string, PresupuestoCard[]> = {}
    for (const c of COLUMNAS) map[c.key] = []
    for (const p of items) if (map[p.estado]) map[p.estado].push(p)
    return map
  }, [items])

  async function aplicarEstado(id: number, nuevoEstado: string) {
    const item = items.find(p => p.id === id)
    if (!item || item.estado === nuevoEstado) return
    const previo = item.estado
    setItems(prev => prev.map(p => p.id === id ? { ...p, estado: nuevoEstado } : p))
    try {
      const res = await fetch(`/api/presupuestos/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setItems(prev => prev.map(p => p.id === id ? { ...p, estado: previo } : p))
        toast.error(err.error || `No se pudo mover a "${nuevoEstado}"`)
        return
      }
      toast.exito(`Presupuesto ${item.numero} → ${nuevoEstado}`)
      router.refresh()
    } catch {
      setItems(prev => prev.map(p => p.id === id ? { ...p, estado: previo } : p))
      toast.error('Error de conexión al cambiar el estado')
    }
  }

  function onDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    setDragOverCol(null)
    const id = parseInt(e.dataTransfer.getData('text/plain'))
    if (isNaN(id)) return
    const item = items.find(p => p.id === id)
    if (!item || item.estado === colKey) return
    // Aprobar tiene efecto secundario (activa el proyecto): pedir confirmación.
    if (colKey === 'Aprobado') { setAprobar(item); return }
    aplicarEstado(id, colKey)
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNAS.map(col => (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col.key) setDragOverCol(col.key) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => onDrop(e, col.key)}
            className={`rounded-xl border p-3 min-h-[120px] transition-colors ${
              dragOverCol === col.key ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
              <span className="text-xs text-muted-foreground ml-auto">{porColumna[col.key].length}</span>
            </div>
            <div className="space-y-2">
              {porColumna[col.key].map(p => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(p.id)) }}
                  className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
                >
                  <Link href={`/presupuestos/${p.id}`} className="text-sm font-semibold text-foreground hover:text-primary">
                    {p.numero}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{p.cliente?.nombre ?? 'Sin cliente'}</p>
                  <p className="text-sm font-bold text-foreground tabular-nums mt-1">{formatCurrency(p.total)}</p>
                  {p.proyecto && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">Proyecto: {p.proyecto.nombre}</p>
                  )}
                </div>
              ))}
              {porColumna[col.key].length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-4">— vacío —</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        abierto={aprobar != null}
        titulo={`¿Aprobar el presupuesto ${aprobar?.numero ?? ''}?`}
        descripcion={
          aprobar?.proyecto
            ? `Al aprobar, el proyecto "${aprobar.proyecto.nombre}" pasará automáticamente a "En Ejecución".`
            : 'El presupuesto quedará marcado como aprobado por el cliente.'
        }
        textoConfirmar="Sí, aprobar"
        cargando={aplicando}
        onConfirmar={async () => {
          if (!aprobar) return
          setAplicando(true)
          await aplicarEstado(aprobar.id, 'Aprobado')
          setAplicando(false)
          setAprobar(null)
        }}
        onCancelar={() => setAprobar(null)}
      />
    </>
  )
}
