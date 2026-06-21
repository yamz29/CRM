'use client'

import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import {
  type Escala,
  type ColumnaEscala,
  generarColumnas,
  rangoCronograma,
  origenEje,
  fechaAPixel,
  PX_POR_DIA,
} from '@/lib/cronograma-escala'
import {
  type Actividad,
  ALTURA_FILA,
  ALTURA_GRUPO,
  ALTURA_HEADER_ESCALA,
  colorEstado,
  aFecha,
  agruparPorCapitulo,
} from './tipos'

interface Props {
  actividades: Actividad[]
  escala: Escala
  usarCalendarioLaboral: boolean
  gruposColapsados: Set<string>
  seleccionadaId: number | null
  readOnly: boolean
  scrollTop: number
  onSeleccionar: (id: number) => void
  onArrastrar: (id: number, nuevoInicio: Date, nuevoFin: Date) => void
  onScrollVertical: (top: number) => void
}

// Tipo de fila renderizada (espaciador de grupo o actividad), espejando la tabla.
type Fila =
  | { tipo: 'grupo'; key: string; capitulo: string | null }
  | { tipo: 'actividad'; key: string; actividad: Actividad }

interface DragState {
  id: number
  modo: 'mover' | 'inicio' | 'fin'
  startX: number
  origInicio: Date
  origFin: Date
  previewInicio: Date
  previewFin: Date
}

export function CronogramaTimeline({
  actividades,
  escala,
  usarCalendarioLaboral,
  gruposColapsados,
  seleccionadaId,
  readOnly,
  scrollTop,
  onSeleccionar,
  onArrastrar,
  onScrollVertical,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerInnerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  // Rango + columnas
  const fechas = useMemo(
    () => actividades.map(a => ({ fechaInicio: aFecha(a.fechaInicio), fechaFin: aFecha(a.fechaFin) })),
    [actividades],
  )
  const { inicio, fin } = useMemo(() => rangoCronograma(fechas, escala === 'semana' ? 7 : 3), [fechas, escala])
  const origen = useMemo(() => origenEje(inicio, escala), [inicio, escala])
  const columnas: ColumnaEscala[] = useMemo(() => generarColumnas(inicio, fin, escala), [inicio, fin, escala])
  const anchoTotal = columnas.length > 0 ? columnas[columnas.length - 1].x + columnas[columnas.length - 1].ancho : 0

  // Filas (espejo de la tabla: grupo + actividades, respetando colapsado)
  const filas: Fila[] = useMemo(() => {
    const grupos = agruparPorCapitulo(actividades)
    const out: Fila[] = []
    for (const g of grupos) {
      const key = g.capitulo ?? '__sin_grupo__'
      out.push({ tipo: 'grupo', key, capitulo: g.capitulo })
      if (!gruposColapsados.has(key)) {
        for (const a of g.items) out.push({ tipo: 'actividad', key: `act-${a.id}`, actividad: a })
      }
    }
    return out
  }, [actividades, gruposColapsados])

  // Sincronizar scroll vertical externo (desde la tabla).
  useEffect(() => {
    if (scrollRef.current && scrollRef.current.scrollTop !== scrollTop) {
      scrollRef.current.scrollTop = scrollTop
    }
  }, [scrollTop])

  // Mapa id → fecha de fin (para conectores de dependencia).
  const posY = useMemo(() => {
    const m = new Map<number, number>()
    let y = 0
    for (const f of filas) {
      if (f.tipo === 'actividad') m.set(f.actividad.id, y)
      y += f.tipo === 'grupo' ? ALTURA_GRUPO : ALTURA_FILA
    }
    return m
  }, [filas])

  const alturaTotal = filas.reduce((s, f) => s + (f.tipo === 'grupo' ? ALTURA_GRUPO : ALTURA_FILA), 0)

  // Línea de "hoy"
  const hoyX = useMemo(() => {
    const hoy = aFecha(new Date())
    if (hoy < inicio || hoy > fin) return null
    return fechaAPixel(hoy, origen, escala) + (escala === 'dia' ? PX_POR_DIA.dia / 2 : 0)
  }, [inicio, fin, origen, escala])

  // ─── Drag de barras ───────────────────────────────────────────
  // `iniciarDrag` solo inicia el estado; los listeners globales de
  // pointermove/up se montan en un efecto mientras hay un drag activo,
  // leyendo el estado más reciente desde la closure del efecto.
  const iniciarDrag = useCallback(
    (e: React.PointerEvent, a: Actividad, modo: DragState['modo']) => {
      if (readOnly) return
      e.preventDefault()
      e.stopPropagation()
      const ini = aFecha(a.fechaInicio)
      const fn = aFecha(a.fechaFin)
      setDrag({
        id: a.id, modo, startX: e.clientX,
        origInicio: ini, origFin: fn, previewInicio: ini, previewFin: fn,
      })
    },
    [readOnly],
  )

  useEffect(() => {
    if (!drag) return
    let actual = drag

    function onMove(e: PointerEvent) {
      const deltaDias = Math.round((e.clientX - actual.startX) / PX_POR_DIA[escala])
      const shift = (fecha: Date, dias: number) => {
        const nd = new Date(fecha)
        nd.setUTCDate(nd.getUTCDate() + dias)
        return nd
      }
      let pInicio = actual.origInicio
      let pFin = actual.origFin
      if (actual.modo === 'mover') {
        pInicio = shift(actual.origInicio, deltaDias)
        pFin = shift(actual.origFin, deltaDias)
      } else if (actual.modo === 'inicio') {
        pInicio = shift(actual.origInicio, deltaDias)
        if (pInicio > actual.origFin) pInicio = actual.origFin
      } else {
        pFin = shift(actual.origFin, deltaDias)
        if (pFin < actual.origInicio) pFin = actual.origInicio
      }
      actual = { ...actual, previewInicio: pInicio, previewFin: pFin }
      setDrag(actual)
    }

    function onUp() {
      const cambio =
        actual.previewInicio.getTime() !== actual.origInicio.getTime() ||
        actual.previewFin.getTime() !== actual.origFin.getTime()
      if (cambio) onArrastrar(actual.id, actual.previewInicio, actual.previewFin)
      setDrag(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // Solo (re)montar cuando arranca un nuevo drag (cambia id/modo) o la escala.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.modo, escala, onArrastrar])

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Encabezado de escala (fijo arriba) */}
      <div
        className="relative shrink-0 border-b border-border bg-muted/40 overflow-hidden"
        style={{ height: ALTURA_HEADER_ESCALA }}
      >
        <div
          ref={headerInnerRef}
          className="absolute top-0 left-0 h-full"
          style={{ width: anchoTotal }}
        >
          {columnas.map((c, i) => (
            <div
              key={i}
              className={`absolute top-0 h-full flex items-center justify-center text-[10px] font-medium border-l border-border/60 ${
                c.finDeSemana && usarCalendarioLaboral ? 'bg-muted/60 text-muted-foreground/70' : 'text-muted-foreground'
              }`}
              style={{ left: c.x, width: c.ancho }}
              title={c.label}
            >
              {escala === 'dia' ? (
                <div className="flex flex-col items-center justify-center leading-tight">
                  <span className="text-[9px] uppercase text-muted-foreground/70">{c.diaSemana}</span>
                  <span className="tabular-nums">{c.fechaCorta}</span>
                </div>
              ) : (
                <span className="truncate px-0.5">{c.fechaCorta}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cuerpo scrolleable (horizontal + vertical) */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        onScroll={e => {
          const el = e.currentTarget
          onScrollVertical(el.scrollTop)
          if (headerInnerRef.current) {
            headerInnerRef.current.style.transform = `translateX(-${el.scrollLeft}px)`
          }
        }}
      >
        <div className="relative" style={{ width: anchoTotal, height: Math.max(alturaTotal, 1) }}>
          {/* Bandas de fin de semana (escala día) */}
          {escala === 'dia' && usarCalendarioLaboral && columnas.map((c, i) =>
            c.finDeSemana ? (
              <div
                key={`fds-${i}`}
                className="absolute top-0 bottom-0 bg-muted/30 pointer-events-none"
                style={{ left: c.x, width: c.ancho }}
              />
            ) : null,
          )}

          {/* Líneas de cuadrícula vertical */}
          {columnas.map((c, i) => (
            <div
              key={`g-${i}`}
              className="absolute top-0 bottom-0 border-l border-border/30 pointer-events-none"
              style={{ left: c.x }}
            />
          ))}

          {/* Línea de hoy */}
          {hoyX !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500/70 z-20 pointer-events-none"
              style={{ left: hoyX }}
            >
              <div className="absolute -top-0 -left-1 w-2 h-2 rounded-full bg-red-500" />
            </div>
          )}

          {/* Conectores de dependencia */}
          <svg className="absolute top-0 left-0 pointer-events-none z-10" width={anchoTotal} height={alturaTotal}>
            {filas.map(f => {
              if (f.tipo !== 'actividad') return null
              const a = f.actividad
              if (!a.dependenciaId) return null
              const pred = actividades.find(x => x.id === a.dependenciaId)
              if (!pred) return null
              const yPredTop = posY.get(pred.id)
              const yActTop = posY.get(a.id)
              if (yPredTop === undefined || yActTop === undefined) return null
              const xPred = fechaAPixel(aFecha(pred.fechaFin), origen, escala) + (escala === 'dia' ? PX_POR_DIA.dia : PX_POR_DIA.semana)
              const yPred = yPredTop + ALTURA_FILA / 2
              const xAct = fechaAPixel(aFecha(a.fechaInicio), origen, escala)
              const yAct = yActTop + ALTURA_FILA / 2
              const midX = Math.max(xPred + 8, xAct - 8)
              return (
                <polyline
                  key={`dep-${a.id}`}
                  points={`${xPred},${yPred} ${midX},${yPred} ${midX},${yAct} ${xAct},${yAct}`}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted-foreground/50"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  markerEnd="url(#flecha)"
                />
              )
            })}
            <defs>
              <marker id="flecha" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground/60" />
              </marker>
            </defs>
          </svg>

          {/* Filas con barras */}
          {(() => {
            let y = 0
            return filas.map(f => {
              if (f.tipo === 'grupo') {
                const row = (
                  <div
                    key={f.key}
                    className="absolute left-0 right-0 bg-muted/20 border-b border-border/40"
                    style={{ top: y, height: ALTURA_GRUPO, width: anchoTotal }}
                  />
                )
                y += ALTURA_GRUPO
                return row
              }
              const a = f.actividad
              const usandoPreview = drag?.id === a.id
              const ini = usandoPreview ? drag!.previewInicio : aFecha(a.fechaInicio)
              const fn = usandoPreview ? drag!.previewFin : aFecha(a.fechaFin)
              const x = fechaAPixel(ini, origen, escala)
              const finX = fechaAPixel(fn, origen, escala) + (escala === 'dia' ? PX_POR_DIA.dia : PX_POR_DIA.semana)
              const ancho = Math.max(finX - x, escala === 'dia' ? PX_POR_DIA.dia : 12)
              const top = y
              const colores = colorEstado(a)
              const seleccionada = seleccionadaId === a.id
              const esHito = a.tipo === 'hito'

              const row = (
                <div
                  key={f.key}
                  className="absolute left-0 flex items-center"
                  style={{ top, height: ALTURA_FILA, width: anchoTotal }}
                >
                  {esHito ? (
                    <button
                      type="button"
                      onClick={() => onSeleccionar(a.id)}
                      onPointerDown={e => iniciarDrag(e, a, 'mover')}
                      className={`absolute ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'} ${seleccionada ? 'ring-2 ring-primary rounded-sm' : ''}`}
                      style={{ left: x }}
                      title={`${a.nombre} (hito)`}
                    >
                      <div className="w-3.5 h-3.5 rotate-45 bg-amber-500 border border-amber-700" />
                    </button>
                  ) : (
                    <div
                      onClick={() => onSeleccionar(a.id)}
                      onPointerDown={e => iniciarDrag(e, a, 'mover')}
                      className={`group absolute rounded-md overflow-hidden ${colores.barra} ${
                        readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                      } ${seleccionada ? 'ring-2 ring-primary' : a.esCritica ? 'ring-1 ring-red-400' : ''}`}
                      style={{ left: x, width: ancho, height: 22 }}
                      title={`${a.nombre} · ${Math.round(a.pctAvance)}%`}
                    >
                      {/* Relleno de avance */}
                      <div
                        className={`absolute top-0 left-0 h-full ${colores.relleno} opacity-80`}
                        style={{ width: `${Math.max(0, Math.min(100, a.pctAvance))}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium text-foreground/90 truncate pointer-events-none">
                        {a.nombre}
                      </span>
                      {/* Asas de redimensión */}
                      {!readOnly && (
                        <>
                          <span
                            onPointerDown={e => iniciarDrag(e, a, 'inicio')}
                            className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20"
                          />
                          <span
                            onPointerDown={e => iniciarDrag(e, a, 'fin')}
                            className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-foreground/20"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
              y += ALTURA_FILA
              return row
            })
          })()}
        </div>
      </div>
    </div>
  )
}
