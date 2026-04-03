'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ETAPAS_PRODUCCION, ETAPA_COLORS, PRIORIDAD_COLORS } from '@/lib/produccion'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

interface Asignacion {
  id: number
  etapa: string
  usuario: { id: number; nombre: string }
}

interface Item {
  id: number
  nombreModulo: string
  tipoModulo: string | null
  dimensiones: string | null
  cantidad: number
  etapa: string
  prioridad: string
  completado: boolean
  checklistQCProceso: string | null
  checklistQCFinal: string | null
  asignaciones: Asignacion[]
}

interface Props {
  ordenId: number
  items: Item[]
  onSelectItem: (id: number | null) => void
  selectedItemId: number | null
  usuarios: { id: number; nombre: string }[]
}

export function KanbanProduccion({ ordenId, items, onSelectItem, selectedItemId }: Props) {
  const router = useRouter()
  const draggingId = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDrop(nuevaEtapa: string) {
    const itemId = draggingId.current
    if (!itemId) return
    setDragOver(null)
    draggingId.current = null
    setError(null)

    const res = await fetch(`/api/produccion/${ordenId}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: nuevaEtapa, _patch: true }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Error al mover item')
      setTimeout(() => setError(null), 4000)
    }

    router.refresh()
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {ETAPAS_PRODUCCION.map((etapa) => {
          const etapaItems = items.filter(i => i.etapa === etapa.key)
          const colors = ETAPA_COLORS[etapa.key]
          const isDraggedOver = dragOver === etapa.key

          return (
            <div
              key={etapa.key}
              className={`flex-shrink-0 w-[200px] rounded-xl border-2 p-2.5 min-h-[300px] transition-all ${
                isDraggedOver
                  ? `${colors?.border || 'border-primary'} ${colors?.bg || 'bg-primary/5'} scale-[1.02]`
                  : `border-border bg-muted/20 dark:bg-muted/10`
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(etapa.key) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(etapa.key) }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${colors?.dot || 'bg-muted-foreground'}`} />
                  <span className="text-xs font-semibold text-foreground">{etapa.label}</span>
                </div>
                <Badge variant="default">{etapaItems.length}</Badge>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {etapaItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => { draggingId.current = item.id }}
                    onClick={() => onSelectItem(selectedItemId === item.id ? null : item.id)}
                    className={`rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none transition-all
                      ${selectedItemId === item.id
                        ? 'ring-2 ring-primary bg-card border border-primary/30'
                        : 'bg-card border border-border hover:shadow-md'
                      }
                      ${item.completado ? 'opacity-60' : ''}
                    `}
                  >
                    <p className="text-xs font-medium text-foreground leading-tight line-clamp-2 mb-1">
                      {item.nombreModulo}
                    </p>
                    {item.dimensiones && (
                      <p className="text-[10px] text-muted-foreground mb-1.5">{item.dimensiones}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORIDAD_COLORS[item.prioridad] || ''}`}>
                        {item.prioridad}
                      </span>
                      {item.cantidad > 1 && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                          ×{item.cantidad}
                        </span>
                      )}
                    </div>
                    {/* Assigned avatars */}
                    {item.asignaciones.filter(a => a.etapa === item.etapa).length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {item.asignaciones
                          .filter(a => a.etapa === item.etapa)
                          .slice(0, 3)
                          .map(a => (
                            <span
                              key={a.id}
                              className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center"
                              title={a.usuario.nombre}
                            >
                              {a.usuario.nombre.charAt(0)}
                            </span>
                          ))}
                        {item.asignaciones.filter(a => a.etapa === item.etapa).length > 3 && (
                          <span className="text-[9px] text-muted-foreground self-center">
                            +{item.asignaciones.filter(a => a.etapa === item.etapa).length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {/* QC indicator */}
                    {(item.etapa === 'QC Proceso' || item.etapa === 'QC Final') && (
                      <QCIndicator
                        checklist={item.etapa === 'QC Proceso' ? item.checklistQCProceso : item.checklistQCFinal}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QCIndicator({ checklist }: { checklist: string | null }) {
  if (!checklist) return null
  try {
    const items = JSON.parse(checklist) as { checked: boolean }[]
    const total = items.length
    const checked = items.filter(i => i.checked).length
    const allDone = checked === total
    return (
      <div className="flex items-center gap-1 mt-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${allDone ? 'bg-green-500' : 'bg-orange-500'}`} />
        <span className="text-[9px] text-muted-foreground">
          QC: {checked}/{total}
        </span>
      </div>
    )
  } catch {
    return null
  }
}
