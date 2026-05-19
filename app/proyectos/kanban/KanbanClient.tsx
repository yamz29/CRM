'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Calendar, MapPin, User, AlertTriangle, Lock, FileText, Receipt } from 'lucide-react'

interface Proyecto {
  id: number
  codigo: string | null
  nombre: string
  estado: string
  ubicacion: string | null
  fechaInicio: string | null
  fechaEstimada: string | null
  avanceFisico: number
  presupuestoEstimado: number | null
  responsable: string | null
  cliente: { id: number; nombre: string } | null
  countPresupuestos: number
  countFacturas: number
}

interface Props {
  proyectos: Proyecto[]
}

// Orden y configuración de columnas del kanban.
// Las "terminales" no aceptan drag in/out — el cambio se hace via modal.
const COLUMNAS = [
  { key: 'Prospecto',     label: 'Prospecto',      color: 'bg-slate-50 border-slate-200',  dot: 'bg-slate-400',  terminal: false },
  { key: 'En Cotización', label: 'En Cotización',  color: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500',   terminal: false },
  { key: 'Adjudicado',    label: 'Adjudicado',     color: 'bg-amber-50 border-amber-200',  dot: 'bg-amber-500',  terminal: false },
  { key: 'En Ejecución',  label: 'En Ejecución',   color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', terminal: false },
  { key: 'Pausado',       label: 'Pausado',        color: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500', terminal: false },
  { key: 'Completado',    label: 'Completado',     color: 'bg-teal-50 border-teal-200',    dot: 'bg-teal-500',   terminal: false },
  { key: 'Cerrado',       label: 'Cerrado',        color: 'bg-slate-100 border-slate-300', dot: 'bg-slate-700',  terminal: true  },
] as const

export function KanbanClient({ proyectos: initialProyectos }: Props) {
  const router = useRouter()
  const [proyectos, setProyectos] = useState(initialProyectos)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [moviendo, setMoviendo] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Agrupar proyectos por estado.
  // Estados desconocidos (ej. "Finalizado" legacy) caen en una columna virtual al final.
  const porColumna = useMemo(() => {
    const map: Record<string, Proyecto[]> = {}
    for (const c of COLUMNAS) map[c.key] = []
    const otros: Proyecto[] = []
    for (const p of proyectos) {
      if (map[p.estado]) map[p.estado].push(p)
      else otros.push(p)
    }
    return { map, otros }
  }, [proyectos])

  function onDragStart(e: React.DragEvent, p: Proyecto) {
    const col = COLUMNAS.find(c => c.key === p.estado)
    if (col?.terminal) {
      // No permitir arrastrar desde columnas terminales
      e.preventDefault()
      return
    }
    setDraggingId(p.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(p.id))
  }

  function onDragOver(e: React.DragEvent, colKey: string) {
    const col = COLUMNAS.find(c => c.key === colKey)
    if (col?.terminal) return // no permitir drop en terminales
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== colKey) setDragOverCol(colKey)
  }

  function onDragLeave() {
    setDragOverCol(null)
  }

  async function onDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    setDragOverCol(null)
    setDraggingId(null)

    const col = COLUMNAS.find(c => c.key === colKey)
    if (col?.terminal) return

    const id = parseInt(e.dataTransfer.getData('text/plain'))
    if (isNaN(id)) return

    const proyecto = proyectos.find(p => p.id === id)
    if (!proyecto) return
    if (proyecto.estado === colKey) return // no-op

    // Optimistic update — actualiza la UI inmediatamente
    const estadoPrevio = proyecto.estado
    setProyectos(prev => prev.map(p => p.id === id ? { ...p, estado: colKey } : p))
    setMoviendo(id)
    setError(null)

    try {
      const res = await fetch(`/api/proyectos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _patch: true, estado: colKey }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // Rollback
        setProyectos(prev => prev.map(p => p.id === id ? { ...p, estado: estadoPrevio } : p))
        setError(err.error || `No se pudo mover el proyecto a "${colKey}"`)
        return
      }
      // Refresh server data por si hay efectos secundarios (auto-cronograma, etc.)
      router.refresh()
    } catch (e) {
      // Rollback
      setProyectos(prev => prev.map(p => p.id === id ? { ...p, estado: estadoPrevio } : p))
      setError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setMoviendo(null)
    }
  }

  return (
    <>
      {error && (
        <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-xs text-red-700 dark:text-red-400 hover:underline">cerrar</button>
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4 pb-4">
        <div className="flex gap-3 min-w-max">
          {COLUMNAS.map(col => {
            const lista = porColumna.map[col.key] ?? []
            const isDragOver = dragOverCol === col.key
            return (
              <div
                key={col.key}
                onDragOver={e => onDragOver(e, col.key)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, col.key)}
                className={`w-72 shrink-0 rounded-lg border ${col.color} ${
                  isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''
                } ${col.terminal ? 'border-dashed' : ''}`}
              >
                {/* Header de columna */}
                <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    {col.terminal && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{lista.length}</span>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[100px]">
                  {lista.length === 0 ? (
                    <div className="text-xs text-muted-foreground/60 text-center py-6">
                      {col.terminal ? 'Sin proyectos cerrados' : 'Vacío'}
                    </div>
                  ) : lista.map(p => (
                    <Card
                      key={p.id}
                      p={p}
                      draggable={!col.terminal}
                      dragging={draggingId === p.id}
                      moviendo={moviendo === p.id}
                      onDragStart={e => onDragStart(e, p)}
                      onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Columna virtual de "Otros" (estados legacy o desconocidos) */}
          {porColumna.otros.length > 0 && (
            <div className="w-72 shrink-0 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Otros</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{porColumna.otros.length}</span>
              </div>
              <div className="p-2 space-y-2">
                {porColumna.otros.map(p => (
                  <Card key={p.id} p={p} draggable={false} dragging={false} moviendo={false}
                    onDragStart={() => {}} onDragEnd={() => {}} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Card individual ───────────────────────────────────────────────────

function Card({
  p, draggable, dragging, moviendo, onDragStart, onDragEnd,
}: {
  p: Proyecto
  draggable: boolean
  dragging: boolean
  moviendo: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const fechaEstimadaPasada = p.fechaEstimada
    ? new Date(p.fechaEstimada) < new Date() && p.estado !== 'Cerrado' && p.estado !== 'Completado'
    : false

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-card rounded-md border border-border p-2.5 shadow-sm hover:shadow-md transition-shadow ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${dragging ? 'opacity-50' : ''} ${moviendo ? 'opacity-70' : ''}`}
    >
      <Link
        href={`/proyectos/${p.id}`}
        onClick={e => { if (dragging) e.preventDefault() }}
        className="block"
        draggable={false}
      >
        {/* Código + nombre */}
        <div className="flex items-start gap-1.5 mb-1.5">
          {p.codigo && (
            <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
              {p.codigo}
            </span>
          )}
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">{p.nombre}</h3>
        </div>

        {/* Cliente */}
        {p.cliente && (
          <p className="text-xs text-muted-foreground truncate mb-1.5 flex items-center gap-1">
            <User className="w-3 h-3 shrink-0" />
            {p.cliente.nombre}
          </p>
        )}

        {/* Ubicación */}
        {p.ubicacion && (
          <p className="text-xs text-muted-foreground truncate mb-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {p.ubicacion}
          </p>
        )}

        {/* Avance físico */}
        {p.avanceFisico > 0 && p.estado !== 'Cerrado' && (
          <div className="mb-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>Avance</span>
              <span className="tabular-nums font-semibold text-foreground">{p.avanceFisico}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  p.avanceFisico >= 100 ? 'bg-green-500' :
                  p.avanceFisico >= 60 ? 'bg-blue-500' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, p.avanceFisico)}%` }}
              />
            </div>
          </div>
        )}

        {/* Presupuesto */}
        {p.presupuestoEstimado != null && p.presupuestoEstimado > 0 && (
          <p className="text-xs font-bold text-foreground tabular-nums mb-1">
            {formatCurrency(p.presupuestoEstimado)}
          </p>
        )}

        {/* Footer: fecha + contadores */}
        <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
          {p.fechaEstimada ? (
            <span className={`flex items-center gap-1 ${fechaEstimadaPasada ? 'text-red-600 dark:text-red-400' : ''}`}>
              <Calendar className="w-3 h-3" />
              {formatDate(p.fechaEstimada)}
              {fechaEstimadaPasada && <AlertTriangle className="w-3 h-3" />}
            </span>
          ) : <span />}
          <div className="flex items-center gap-2">
            {p.countPresupuestos > 0 && (
              <span className="flex items-center gap-0.5" title={`${p.countPresupuestos} presupuesto(s)`}>
                <FileText className="w-3 h-3" />
                {p.countPresupuestos}
              </span>
            )}
            {p.countFacturas > 0 && (
              <span className="flex items-center gap-0.5" title={`${p.countFacturas} factura(s)`}>
                <Receipt className="w-3 h-3" />
                {p.countFacturas}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
