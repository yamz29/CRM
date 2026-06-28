'use client'

import { useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, ChevronUp, Plus, Diamond, GripVertical, AlertTriangle } from 'lucide-react'
import {
  type Actividad,
  ALTURA_FILA,
  ALTURA_GRUPO,
  ALTURA_HEADER_ESCALA,
  agruparPorCapitulo,
} from './tipos'

interface Props {
  actividades: Actividad[]
  gruposColapsados: Set<string>
  seleccionadaId: number | null
  readOnly: boolean
  scrollTop: number
  onToggleGrupo: (key: string) => void
  onSeleccionar: (id: number) => void
  onAgregar: (tipo: 'tarea' | 'hito', capitulo: string | null) => void
  onMover: (id: number, dir: 'up' | 'down') => void
  onScrollVertical: (top: number) => void
}

function fmt(v: string | Date): string {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

export function CronogramaTabla({
  actividades,
  gruposColapsados,
  seleccionadaId,
  readOnly,
  scrollTop,
  onToggleGrupo,
  onSeleccionar,
  onAgregar,
  onMover,
  onScrollVertical,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const grupos = agruparPorCapitulo(actividades)

  // Sincronizar scroll vertical externo (desde el timeline).
  useEffect(() => {
    if (scrollRef.current && scrollRef.current.scrollTop !== scrollTop) {
      scrollRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  // Lista plana de actividades visibles para calcular límites de "mover".
  const visibles = grupos.flatMap(g =>
    gruposColapsados.has(g.capitulo ?? '__sin_grupo__') ? [] : g.items,
  )

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden border-r border-border bg-card min-w-0">
      {/* Encabezado de columnas (alineado con el header de escala) */}
      <div
        className="shrink-0 flex items-center border-b border-border bg-muted/40 px-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
        style={{ height: ALTURA_HEADER_ESCALA }}
      >
        <span className="flex-1">Actividad</span>
        <span className="w-20 text-center hidden sm:block">Inicio</span>
        <span className="w-20 text-center hidden sm:block">Fin</span>
        <span className="w-16 text-center">Avance</span>
      </div>

      {/* Cuerpo */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto"
        onScroll={e => onScrollVertical(e.currentTarget.scrollTop)}
      >
        {grupos.map(g => {
          const key = g.capitulo ?? '__sin_grupo__'
          const colapsado = gruposColapsados.has(key)
          return (
            <div key={key}>
              {/* Encabezado de grupo */}
              <div
                className="flex items-center gap-1 px-2 bg-muted/30 border-b border-border/60 group/grp"
                style={{ height: ALTURA_GRUPO }}
              >
                <button
                  type="button"
                  onClick={() => onToggleGrupo(key)}
                  className="flex items-center gap-1 flex-1 min-w-0 text-left"
                >
                  {colapsado ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                  <span className="text-xs font-semibold text-foreground truncate">
                    {g.capitulo ?? 'General'}
                  </span>
                  <span className="text-2xs text-muted-foreground shrink-0">({g.items.length})</span>
                </button>
                {!readOnly && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/grp:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onAgregar('tarea', g.capitulo)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Añadir tarea a este grupo"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAgregar('hito', g.capitulo)}
                      className="p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-muted"
                      title="Añadir hito a este grupo"
                    >
                      <Diamond className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Filas */}
              {!colapsado && g.items.map(a => {
                const idxGlobal = visibles.findIndex(x => x.id === a.id)
                const esPrimera = idxGlobal === 0
                const esUltima = idxGlobal === visibles.length - 1
                const seleccionada = seleccionadaId === a.id
                return (
                  <div
                    key={a.id}
                    onClick={() => onSeleccionar(a.id)}
                    className={`group/row flex items-center gap-1 px-2 border-b border-border/40 cursor-pointer transition-colors ${
                      seleccionada ? 'bg-primary/10' : 'hover:bg-muted/40'
                    } ${a.esCritica ? 'border-l-2 border-l-red-500' : ''}`}
                    style={{ height: ALTURA_FILA }}
                  >
                    {/* Asa de reordenar */}
                    {!readOnly && (
                      <div className="flex flex-col -my-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onMover(a.id, 'up') }}
                          disabled={esPrimera}
                          className="text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                          title="Subir"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onMover(a.id, 'down') }}
                          disabled={esUltima}
                          className="text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                          title="Bajar"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {readOnly && <GripVertical className="w-3 h-3 text-muted-foreground/20 shrink-0" />}

                    {/* Nombre */}
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                      {a.tipo === 'hito' && <Diamond className="w-3 h-3 text-amber-500 shrink-0" />}
                      <span className="text-xs text-foreground truncate">{a.nombre}</span>
                      {a.esCritica && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                    </div>

                    {/* Fechas */}
                    <span className="w-20 text-center text-2xs text-muted-foreground tabular-nums hidden sm:block">{fmt(a.fechaInicio)}</span>
                    <span className="w-20 text-center text-2xs text-muted-foreground tabular-nums hidden sm:block">{fmt(a.fechaFin)}</span>

                    {/* Mini-barra de avance */}
                    <div className="w-16 flex items-center gap-1 shrink-0">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${a.pctAvance >= 100 ? 'bg-teal-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.max(0, Math.min(100, a.pctAvance))}%` }}
                        />
                      </div>
                      <span className="text-2xs text-muted-foreground tabular-nums w-6 text-right">{Math.round(a.pctAvance)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
