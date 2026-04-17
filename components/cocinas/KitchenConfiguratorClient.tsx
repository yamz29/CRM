'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calculator, LayoutPanelLeft, Map, Search, X,
  Trash2, FileText, Layers, ClipboardList, Copy, Check, Grid2x2,
} from 'lucide-react'
import { NEST_COLORS } from '@/lib/nesting'
import { cn, formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModuloBasic {
  id: number
  nombre: string
  tipoModulo: string
  ancho: number
  alto: number
  profundidad: number
  colorAcabado: string | null
  materialTableroId: number | null
}

interface Placement {
  id: number
  wallId: number | null   // null = isla
  moduloId: number
  posicion: number
  nivel: string           // base | alto | torre | isla
  alturaDesdeSupelo: number
  posX: number            // plan absolute x (isla)
  posY: number            // plan absolute y (isla)
  modulo: ModuloBasic
}

interface Wall {
  id: number
  nombre: string
  longitud: number
  orden: number
}

interface KitchenProjectData {
  id: number
  nombre: string
  layoutType: string
  alturaMm: number
  profBase: number
  profAlto: number
  paredes: Wall[]
  placements: Placement[]
}

interface PiezaCorte {
  etiqueta: string
  nombre: string
  largo: number
  ancho: number
  cantidad: number
  modulo: string
  tapacanto: string[]
}

interface PlacedPieceVis {
  key: string
  etiqueta: string
  nombre: string
  w: number
  h: number
  x: number
  y: number
  rotada: boolean
  colorIdx: number
}

interface NestSheetVis {
  id: number
  piezas: PlacedPieceVis[]
}

interface CalcResult {
  tablero: string
  boardW: number
  boardH: number
  numPlanchas: number
  aprovechamiento: number
  costoEstimado: number
  piezaTotal: number
  sheetTotal: number
  piezas: PiezaCorte[]
  sheets: NestSheetVis[]
}

interface Props {
  project: KitchenProjectData
  availableModules: ModuloBasic[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NIVEL_COLORS: Record<string, { fill: string; stroke: string; badge: string }> = {
  base:  { fill: '#1d4ed8', stroke: '#3b82f6', badge: 'bg-blue-700 text-blue-100' },
  alto:  { fill: '#15803d', stroke: '#22c55e', badge: 'bg-green-700 text-green-100' },
  torre: { fill: '#b45309', stroke: '#f59e0b', badge: 'bg-amber-700 text-amber-100' },
  isla:  { fill: '#6b21a8', stroke: '#a855f7', badge: 'bg-purple-800 text-purple-100' },
}

const SNAP_MM = 50
const CANVAS_HEIGHT_PX = 380
const COUNTERTOP_MM = 850
const DEFAULT_ALTURA = 1500

const TIPO_FILTER_MAP: Record<string, string[]> = {
  Todos: [],
  Base:  ['Base con puertas', 'Base con cajones', 'Base mixto'],
  Aéreo: ['Aéreo con puertas', 'Repisa'],
  Torre: ['Columna', 'Torre'],
  'Electrod.': ['Electrodoméstico'],
  Otro:  ['Closet', 'Baño', 'Oficina', 'Otro'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wall placements only collide within the same nivel group.
 *  base+torre collide with each other; alto only collides with alto.
 *  Repisas (tablas delgadas) son exentas: no chocan con nada y nada choca con ellas,
 *  ya que pueden coexistir a diferentes alturas en la misma pared. */
function overlaps(
  existingPlacements: Placement[],
  wallId: number,
  newPos: number,
  newWidth: number,
  nivelGroup: 'floor' | 'wall', // floor = base|torre, wall = alto
  excludeId?: number,
  placingTipo?: string,
): boolean {
  if (placingTipo === 'Repisa') return false
  return existingPlacements
    .filter((p) => {
      if (p.wallId !== wallId || p.id === excludeId) return false
      if (p.modulo.tipoModulo === 'Repisa') return false
      if (nivelGroup === 'wall') return p.nivel === 'alto'
      return p.nivel === 'base' || p.nivel === 'torre'
    })
    .some((p) => {
      const pEnd = p.posicion + p.modulo.ancho
      const newEnd = newPos + newWidth
      return newPos < pEnd && newEnd > p.posicion
    })
}

function nivelGroup(nivel: string): 'floor' | 'wall' {
  return nivel === 'alto' ? 'wall' : 'floor'
}

const TIPOS_AEREO = ['Aéreo con puertas', 'Aéreo', 'Repisa']

function nivelForTipo(tipoModulo: string): string {
  return TIPOS_AEREO.some((t) => tipoModulo.includes(t)) ? 'alto' : 'base'
}

function getAdjacentWalls(
  walls: Wall[],
  wallId: number,
  layoutType: string,
): { atStart: Wall | null; atEnd: Wall | null } {
  const idx = walls.findIndex((w) => w.id === wallId)
  if (idx === -1) return { atStart: null, atEnd: null }
  if (layoutType === 'lineal') {
    return { atStart: walls[idx - 1] ?? null, atEnd: walls[idx + 1] ?? null }
  }
  if (layoutType === 'L') {
    const [wA, wB] = walls
    if (wallId === wA?.id) return { atStart: wB ?? null, atEnd: null }
    if (wallId === wB?.id) return { atStart: wA ?? null, atEnd: null }
    return { atStart: null, atEnd: null }
  }
  const [wA, wB, wC] = walls
  if (wallId === wA?.id) return { atStart: wB ?? null, atEnd: wC ?? null }
  if (wallId === wB?.id) return { atStart: null, atEnd: wA ?? null }
  if (wallId === wC?.id) return { atStart: null, atEnd: wA ?? null }
  return { atStart: null, atEnd: null }
}

// ── Plan segment layout ───────────────────────────────────────────────────────

type PlanSegment = {
  x1: number; y1: number; x2: number; y2: number
  wall: Wall
  cabinetDir: 'down' | 'up' | 'right' | 'left'
  isHoriz: boolean
}

function computeSegments(
  walls: Wall[], layoutType: string, scale: number, padX: number, padY: number,
): PlanSegment[] {
  const segs: PlanSegment[] = []
  if (layoutType === 'lineal') {
    let ox = padX
    for (const w of walls) {
      segs.push({ x1: ox, y1: padY, x2: ox + w.longitud * scale, y2: padY, wall: w, cabinetDir: 'down', isHoriz: true })
      ox += w.longitud * scale
    }
  } else if (layoutType === 'L') {
    const [w0, w1] = walls
    if (w0) segs.push({ x1: padX, y1: padY, x2: padX + w0.longitud * scale, y2: padY, wall: w0, cabinetDir: 'down', isHoriz: true })
    if (w1) segs.push({ x1: padX, y1: padY, x2: padX, y2: padY + w1.longitud * scale, wall: w1, cabinetDir: 'right', isHoriz: false })
  } else {
    const [w0, w1, w2] = walls
    const rightX = padX + (w0?.longitud ?? 0) * scale
    if (w0) segs.push({ x1: padX, y1: padY, x2: rightX, y2: padY, wall: w0, cabinetDir: 'down', isHoriz: true })
    if (w1) segs.push({ x1: padX, y1: padY, x2: padX, y2: padY + w1.longitud * scale, wall: w1, cabinetDir: 'right', isHoriz: false })
    if (w2) segs.push({ x1: rightX, y1: padY, x2: rightX, y2: padY + w2.longitud * scale, wall: w2, cabinetDir: 'left', isHoriz: false })
  }
  return segs
}

// ── Elevation SVG ─────────────────────────────────────────────────────────────

function ElevationSVG({
  wall, placements, allPlacements, alturaMm,
  selectedPlacementId, placingModule, hoverX,
  flipped = false,
  adjacentAtStart, adjacentAtEnd,
  zoom = 1,
  onCanvasClick, onCanvasMouseMove, onCanvasMouseLeave,
  onPlacementClick, onDragEnd,
}: {
  wall: Wall
  placements: Placement[]
  allPlacements: Placement[]
  alturaMm: number
  selectedPlacementId: number | null
  placingModule: ModuloBasic | null
  hoverX: number | null
  flipped?: boolean
  adjacentAtStart: Wall | null
  adjacentAtEnd: Wall | null
  zoom?: number
  onCanvasClick: (xMm: number) => void
  onCanvasMouseMove: (xMm: number) => void
  onCanvasMouseLeave: () => void
  onPlacementClick: (p: Placement) => void
  onDragEnd: (id: number, newPos: number, targetWall?: Wall) => void
}) {
  const canvasH = CANVAS_HEIGHT_PX * zoom
  const scale = canvasH / alturaMm
  const svgWidth = Math.max(wall.longitud * scale, 400)
  const yFloor = canvasH
  const yCountertop = yFloor - COUNTERTOP_MM * scale

  const [dragState, setDragState] = useState<{
    id: number; startClientX: number; startPosicion: number; currentPosicion: number
  } | null>(null)

  const rulerTicks: number[] = []
  for (let mm = 0; mm <= wall.longitud; mm += 500) rulerTicks.push(mm)
  const gridLines: number[] = []
  for (let mm = 0; mm <= wall.longitud; mm += 600) gridLines.push(mm)

  const draggingP = dragState ? allPlacements.find((p) => p.id === dragState.id) : null

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={canvasH + 24}
        className={cn('block select-none',
          placingModule ? 'cursor-crosshair' : dragState ? 'cursor-grabbing' : 'cursor-default',
        )}
        onClick={(e) => {
          if (dragState) return
          const rect = e.currentTarget.getBoundingClientRect()
          const rawMm = (e.clientX - rect.left) / scale
          onCanvasClick(flipped ? wall.longitud - rawMm : rawMm)
        }}
        onMouseMove={(e) => {
          if (dragState) {
            const dMm = (e.clientX - dragState.startClientX) / scale
            setDragState((prev) => prev ? { ...prev, currentPosicion: prev.startPosicion + (flipped ? -dMm : dMm) } : null)
          } else {
            const rect = e.currentTarget.getBoundingClientRect()
            const rawMm = (e.clientX - rect.left) / scale
            onCanvasMouseMove(flipped ? wall.longitud - rawMm : rawMm)
          }
        }}
        onMouseLeave={() => {
          if (dragState) { onDragEnd(dragState.id, dragState.startPosicion); setDragState(null) }
          else onCanvasMouseLeave()
        }}
        onMouseUp={(e) => {
          if (!dragState) return
          const dMm = (e.clientX - dragState.startClientX) / scale
          const raw = dragState.startPosicion + dMm
          const p = allPlacements.find((x) => x.id === dragState.id)
          if (p) {
            const modAncho = p.modulo.ancho || 300
            let targetWall: Wall | undefined
            let finalPos: number
            if (raw < 0 && adjacentAtStart) {
              finalPos = Math.max(0, adjacentAtStart.longitud - modAncho)
              targetWall = adjacentAtStart
            } else if (raw + modAncho > wall.longitud && adjacentAtEnd) {
              finalPos = 0
              targetWall = adjacentAtEnd
            } else {
              const snapped = Math.round(raw / SNAP_MM) * SNAP_MM
              finalPos = Math.max(0, Math.min(snapped, wall.longitud - modAncho))
              if (overlaps(allPlacements, wall.id, finalPos, modAncho, nivelGroup(p.nivel), dragState.id, p.modulo.tipoModulo))
                finalPos = dragState.startPosicion
            }
            onDragEnd(dragState.id, finalPos, targetWall)
          }
          setDragState(null)
        }}
      >
        <rect x={0} y={0} width={svgWidth} height={canvasH + 24} fill="#0f172a" />
        {gridLines.map((mm) => (
          <line key={mm} x1={mm * scale} y1={0} x2={mm * scale} y2={canvasH} stroke="#1e293b" strokeWidth={1} />
        ))}
        <line x1={0} y1={yCountertop} x2={svgWidth} y2={yCountertop} stroke="#64748b" strokeWidth={1} strokeDasharray="6,4" />
        <text x={4} y={yCountertop - 3} fill="#64748b" fontSize={9}>Muestrario 850mm</text>
        <line x1={0} y1={yFloor} x2={svgWidth} y2={yFloor} stroke="#475569" strokeWidth={2} />

        {/* Placements */}
        {placements.map((p) => {
          const isDragging = dragState?.id === p.id
          const isAppliance = p.modulo.tipoModulo === 'Electrodoméstico'
          const colors = isAppliance
            ? { fill: '#374151', stroke: '#6b7280' }
            : (NIVEL_COLORS[p.nivel] ?? NIVEL_COLORS.base)
          const modAncho = p.modulo.ancho || 300
          const modAlto = p.modulo.alto || 720
          const currentPos = isDragging && dragState ? dragState.currentPosicion : p.posicion

          let rectY: number, rectH: number
          if (p.nivel === 'alto') {
            const altBottom = p.alturaDesdeSupelo ?? DEFAULT_ALTURA
            rectH = modAlto * scale
            rectY = yFloor - (altBottom + modAlto) * scale
          } else {
            rectH = modAlto * scale
            rectY = yFloor - rectH
          }

          const displayPos = flipped ? (wall.longitud - currentPos - modAncho) : currentPos
          const rectX = displayPos * scale
          const rectW = Math.max(modAncho * scale, 8)
          const isSelected = p.id === selectedPlacementId

          return (
            <g
              key={p.id}
              onClick={(e) => {
                if (dragState && Math.abs(e.clientX - (dragState.startClientX)) > 5) return
                e.stopPropagation()
                onPlacementClick(p)
              }}
              onMouseDown={(e) => {
                if (placingModule) return
                e.stopPropagation()
                setDragState({ id: p.id, startClientX: e.clientX, startPosicion: p.posicion, currentPosicion: p.posicion })
              }}
              className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
            >
              <rect
                x={rectX} y={rectY} width={rectW} height={rectH}
                fill={colors.fill} fillOpacity={isAppliance ? 0.9 : 0.7}
                stroke={isDragging ? '#f59e0b' : isSelected ? '#ffffff' : colors.stroke}
                strokeWidth={isDragging || isSelected ? 2 : 1}
                strokeDasharray={isAppliance ? '5,3' : undefined}
                rx={2}
              />
              {rectW > 24 && rectH > 16 && (
                <text x={rectX + rectW / 2} y={rectY + rectH / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(10, rectW / 7, rectH / 2.5)} fill="#ffffff" fontFamily="sans-serif">
                  {rectW > 60 ? p.modulo.nombre.slice(0, 14) : p.modulo.nombre.slice(0, 4)}
                </text>
              )}
              {rectW > 30 && rectH > 28 && (
                <text x={rectX + rectW / 2} y={rectY + rectH / 2 + 10} textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fill="#cbd5e1" fontFamily="sans-serif">
                  {Math.round(modAncho)}×{Math.round(modAlto)}
                </text>
              )}
            </g>
          )
        })}

        {/* Ghost preview */}
        {placingModule && hoverX !== null && (() => {
          const snapped = Math.round(hoverX / SNAP_MM) * SNAP_MM
          const clamped = Math.max(0, Math.min(snapped, wall.longitud - (placingModule.ancho || 300)))
          const isAereo = nivelForTipo(placingModule.tipoModulo) === 'alto'
          const ng = nivelGroup(isAereo ? 'alto' : 'base')
          const hasOv = overlaps(allPlacements, wall.id, clamped, placingModule.ancho || 300, ng, undefined, placingModule.tipoModulo)
          const rectW = Math.max((placingModule.ancho || 300) * scale, 40)
          const rectH = Math.max((placingModule.alto || 720) * scale, 30)
          const ghostPos = flipped ? (wall.longitud - clamped - (placingModule.ancho || 300)) : clamped
          const rectX = ghostPos * scale
          const rectY = isAereo
            ? yFloor - (DEFAULT_ALTURA + (placingModule.alto || 720)) * scale
            : yFloor - rectH
          const color = hasOv ? '#ef4444' : (isAereo ? '#22c55e' : '#3b82f6')
          return (
            <g pointerEvents="none">
              <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} fillOpacity={0.25}
                stroke={color} strokeWidth={1.5} strokeDasharray="5,3" rx={2} />
              <text x={rectX + rectW / 2} y={rectY + rectH / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fill={color} fontFamily="sans-serif">
                {placingModule.ancho ? `${Math.round(placingModule.ancho)}mm` : '?mm'}
              </text>
            </g>
          )
        })()}

        {/* Jump indicators */}
        {draggingP && dragState && (() => {
          const modAncho = draggingP.modulo.ancho || 300
          const nearLeft = dragState.currentPosicion < 0 && adjacentAtStart
          const nearRight = dragState.currentPosicion + modAncho > wall.longitud && adjacentAtEnd
          return (
            <>
              {nearLeft && <g pointerEvents="none">
                <rect x={0} y={0} width={70} height={canvasH} fill="#f59e0b" fillOpacity={0.1} />
                <text x={35} y={canvasH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#f59e0b" fontFamily="sans-serif">← {adjacentAtStart.nombre}</text>
              </g>}
              {nearRight && <g pointerEvents="none">
                <rect x={svgWidth - 70} y={0} width={70} height={canvasH} fill="#f59e0b" fillOpacity={0.1} />
                <text x={svgWidth - 35} y={canvasH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#f59e0b" fontFamily="sans-serif">{adjacentAtEnd.nombre} →</text>
              </g>}
            </>
          )
        })()}

        {/* Ruler */}
        <rect x={0} y={canvasH} width={svgWidth} height={24} fill="#1e293b" />
        {rulerTicks.map((mm) => (
          <g key={mm}>
            <line x1={mm * scale} y1={canvasH} x2={mm * scale} y2={canvasH + (mm % 1000 === 0 ? 8 : 5)} stroke="#475569" strokeWidth={1} />
            {mm % 500 === 0 && <text x={mm * scale} y={canvasH + 18} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">{mm}</text>}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Interactive Plan SVG ──────────────────────────────────────────────────────

function InteractivePlanSVG({
  walls, placements, layoutType, profBase,
  activeWallId, onWallClick,
  placingModule, isIslandMode,
  selectedPlacementId,
  onWallPlace, onIslandPlace,
  onPlacementClick, onPlanDragEnd,
}: {
  walls: Wall[]
  placements: Placement[]
  layoutType: string
  profBase: number
  activeWallId: number
  onWallClick: (wallId: number) => void
  placingModule: ModuloBasic | null
  isIslandMode: boolean
  selectedPlacementId: number | null
  onWallPlace: (wallId: number, positionMm: number) => void
  onIslandPlace: (posX: number, posY: number) => void
  onPlacementClick: (p: Placement) => void
  onPlanDragEnd: (id: number, newPosicion?: number, newPosX?: number, newPosY?: number) => void
}) {
  const PLAN_W = 580
  const PLAN_H = 380
  const padX = 70, padY = 70
  const wallThick = 8

  if (!walls.length) {
    return (
      <div className="flex items-center justify-center h-[340px] bg-slate-900 dark:bg-slate-900 rounded-lg text-muted-foreground text-sm">
        Sin paredes configuradas
      </div>
    )
  }

  const maxLen = Math.max(...walls.map((w) => w.longitud), 1000)
  const scale = Math.min(PLAN_W * 0.65, PLAN_H * 0.65) / maxLen
  const segments = computeSegments(walls, layoutType, scale, padX, padY)

  // Determine floor bounding box for island placement (area inside walls)
  // Simple: full SVG canvas minus padding
  const floorX1 = padX + (layoutType === 'lineal' ? 0 : profBase * scale + 4)
  const floorY1 = padY + profBase * scale + 4
  const floorX2 = PLAN_W - padX / 2
  const floorY2 = PLAN_H - padY / 2

  const [hoverPos, setHoverPos] = useState<{ segIdx: number; posMm: number } | null>(null)
  const [hoverIsland, setHoverIsland] = useState<{ x: number; y: number } | null>(null) // SVG px
  const [planDrag, setPlanDrag] = useState<{
    id: number; type: 'wall' | 'island'
    segIdx: number
    startCX: number; startCY: number
    startPosicion: number
    startPX: number; startPY: number
    currentPosicion: number
    currentPX: number; currentPY: number
  } | null>(null)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - svgRect.left
    const my = e.clientY - svgRect.top

    if (planDrag) {
      const dX = (e.clientX - planDrag.startCX) / scale
      const dY = (e.clientY - planDrag.startCY) / scale
      if (planDrag.type === 'island') {
        setPlanDrag((prev) => prev ? { ...prev, currentPX: prev.startPX + dX, currentPY: prev.startPY + dY } : null)
      } else {
        const seg = segments[planDrag.segIdx]
        const d = seg.isHoriz ? dX : dY
        setPlanDrag((prev) => prev ? { ...prev, currentPosicion: prev.startPosicion + d } : null)
      }
      return
    }

    if (!placingModule) { setHoverPos(null); setHoverIsland(null); return }

    if (isIslandMode) {
      // Show island ghost anywhere in the floor area
      if (mx >= floorX1 && mx <= floorX2 && my >= floorY1 && my <= floorY2) {
        setHoverIsland({ x: mx, y: my })
      } else {
        setHoverIsland(null)
      }
      setHoverPos(null)
      return
    }

    // Wall placement — only on the active wall segment
    setHoverIsland(null)
    const activeSeg = segments.find((s) => s.wall.id === activeWallId)
    if (!activeSeg) { setHoverPos(null); return }

    const depth = profBase * scale
    const si = segments.indexOf(activeSeg)
    let found: { segIdx: number; posMm: number } | null = null

    if (activeSeg.isHoriz) {
      const yMin = activeSeg.y1 - 4
      const yMax = activeSeg.y1 + depth + 4
      if (my >= yMin && my <= yMax && mx >= activeSeg.x1 && mx <= activeSeg.x2) {
        found = { segIdx: si, posMm: Math.max(0, Math.round(((mx - activeSeg.x1) / scale) / SNAP_MM) * SNAP_MM) }
      }
    } else {
      const x = activeSeg.x1
      const xMin = activeSeg.cabinetDir === 'right' ? x - 4 : x - depth - 4
      const xMax = activeSeg.cabinetDir === 'right' ? x + depth + 4 : x + 4
      if (mx >= xMin && mx <= xMax && my >= activeSeg.y1 && my <= activeSeg.y2) {
        found = { segIdx: si, posMm: Math.max(0, Math.round(((my - activeSeg.y1) / scale) / SNAP_MM) * SNAP_MM) }
      }
    }
    setHoverPos(found)
  }

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (planDrag) return
    if (!placingModule) return

    const svgRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - svgRect.left
    const my = e.clientY - svgRect.top

    if (isIslandMode && hoverIsland) {
      // Convert SVG px to mm
      const xMm = (mx - padX) / scale
      const yMm = (my - padY) / scale
      onIslandPlace(xMm, yMm)
      return
    }

    if (hoverPos !== null) {
      const seg = segments[hoverPos.segIdx]
      const clamped = Math.min(hoverPos.posMm, seg.wall.longitud - (placingModule.ancho || 300))
      onWallPlace(seg.wall.id, Math.max(0, clamped))
    }
  }

  function handleMouseUp() {
    if (!planDrag) return
    const p = placements.find((x) => x.id === planDrag.id)
    if (p) {
      if (planDrag.type === 'island') {
        onPlanDragEnd(planDrag.id, undefined, planDrag.currentPX, planDrag.currentPY)
      } else {
        const seg = segments[planDrag.segIdx]
        const modAncho = p.modulo.ancho || 300
        const snapped = Math.round(planDrag.currentPosicion / SNAP_MM) * SNAP_MM
        const clamped = Math.max(0, Math.min(snapped, seg.wall.longitud - modAncho))
        if (!overlaps(placements, seg.wall.id, clamped, modAncho, nivelGroup(p.nivel), planDrag.id, p.modulo.tipoModulo)) {
          onPlanDragEnd(planDrag.id, clamped)
        } else {
          onPlanDragEnd(planDrag.id, planDrag.startPosicion)
        }
      }
    }
    setPlanDrag(null)
  }

  // Build cabinet rects for wall-attached modules
  type CabRect = {
    x: number; y: number; w: number; h: number
    nivel: string; isAppliance: boolean
    placement: Placement; isDragging: boolean; isSelected: boolean; segIdx: number
  }
  const cabinetRects: CabRect[] = []
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]
    const wallPs = placements.filter((p) => p.wallId === seg.wall.id)
    for (const p of wallPs) {
      const isAppliance = p.modulo.tipoModulo === 'Electrodoméstico'
      const depth = (p.nivel === 'alto' ? profBase * 0.6 : profBase) * scale
      const isDragging = planDrag?.id === p.id && planDrag.type === 'wall'
      const currentPos = isDragging && planDrag ? planDrag.currentPosicion : p.posicion
      const moduleW = (p.modulo.ancho || 300) * scale
      let x: number, y: number, w: number, h: number
      if (seg.cabinetDir === 'down') { x = seg.x1 + currentPos * scale; y = seg.y1; w = moduleW; h = depth }
      else if (seg.cabinetDir === 'up') { x = seg.x1 + currentPos * scale; y = seg.y1 - depth; w = moduleW; h = depth }
      else if (seg.cabinetDir === 'right') { x = seg.x1; y = seg.y1 + currentPos * scale; w = depth; h = moduleW }
      else { x = seg.x1 - depth; y = seg.y1 + currentPos * scale; w = depth; h = moduleW }
      cabinetRects.push({ x, y, w, h, nivel: p.nivel, isAppliance, placement: p, isDragging, isSelected: p.id === selectedPlacementId, segIdx: si })
    }
  }

  // Island placements
  const islandRects = placements.filter((p) => p.nivel === 'isla')

  return (
    <div className="overflow-auto">
      <svg
        width={PLAN_W} height={PLAN_H}
        className={cn('block bg-slate-900 dark:bg-slate-900 rounded-lg select-none',
          planDrag ? 'cursor-grabbing' : placingModule ? 'cursor-crosshair' : 'cursor-default',
        )}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (planDrag) {
            if (planDrag.type === 'island') onPlanDragEnd(planDrag.id, undefined, planDrag.startPX, planDrag.startPY)
            else onPlanDragEnd(planDrag.id, planDrag.startPosicion)
            setPlanDrag(null)
          }
          setHoverPos(null)
          setHoverIsland(null)
        }}
      >
        {/* Island floor ghost */}
        {placingModule && isIslandMode && (
          <rect x={floorX1} y={floorY1} width={floorX2 - floorX1} height={floorY2 - floorY1}
            fill="#a855f7" fillOpacity={0.04} stroke="#a855f7" strokeWidth={1} strokeDasharray="6,4" />
        )}

        {/* Wall cabinet rects */}
        {cabinetRects.map((r, i) => {
          if (r.isAppliance) return (
            <g key={i} onClick={(e) => { e.stopPropagation(); onPlacementClick(r.placement) }} className="cursor-pointer">
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#374151" fillOpacity={0.9}
                stroke={r.isSelected ? '#fff' : '#6b7280'} strokeWidth={r.isSelected ? 2 : 1.5}
                strokeDasharray="4,2" rx={2} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={8} fill="#9ca3af" fontFamily="sans-serif">⚡</text>
            </g>
          )
          const colors = NIVEL_COLORS[r.nivel] ?? NIVEL_COLORS.base
          return (
            <g key={i}
              onClick={(e) => { e.stopPropagation(); onPlacementClick(r.placement) }}
              onMouseDown={(e) => {
                if (placingModule) return
                e.stopPropagation()
                setPlanDrag({
                  id: r.placement.id, type: 'wall', segIdx: r.segIdx,
                  startCX: e.clientX, startCY: e.clientY,
                  startPosicion: r.placement.posicion,
                  startPX: 0, startPY: 0,
                  currentPosicion: r.placement.posicion,
                  currentPX: 0, currentPY: 0,
                })
              }}
              className="cursor-grab"
            >
              <rect x={r.x} y={r.y} width={r.w} height={r.h}
                fill={colors.fill} fillOpacity={0.65}
                stroke={r.isDragging ? '#f59e0b' : r.isSelected ? '#ffffff' : colors.stroke}
                strokeWidth={r.isDragging || r.isSelected ? 2 : 1} rx={1} />
            </g>
          )
        })}

        {/* Island rects */}
        {islandRects.map((p) => {
          const isDragging = planDrag?.id === p.id && planDrag.type === 'island'
          const isSelected = p.id === selectedPlacementId
          const colors = NIVEL_COLORS.isla
          const modAncho = p.modulo.ancho || 600
          const modProf = p.modulo.profundidad || 900
          const px = isDragging && planDrag ? planDrag.currentPX : p.posX
          const py = isDragging && planDrag ? planDrag.currentPY : p.posY
          const rx = padX + px * scale
          const ry = padY + py * scale
          const rw = modAncho * scale
          const rh = modProf * scale
          return (
            <g key={p.id}
              onClick={(e) => { e.stopPropagation(); onPlacementClick(p) }}
              onMouseDown={(e) => {
                if (placingModule) return
                e.stopPropagation()
                setPlanDrag({
                  id: p.id, type: 'island', segIdx: -1,
                  startCX: e.clientX, startCY: e.clientY,
                  startPosicion: 0, startPX: p.posX, startPY: p.posY,
                  currentPosicion: 0, currentPX: p.posX, currentPY: p.posY,
                })
              }}
              className="cursor-grab"
            >
              <rect x={rx} y={ry} width={rw} height={rh}
                fill={colors.fill} fillOpacity={0.6}
                stroke={isDragging ? '#f59e0b' : isSelected ? '#fff' : colors.stroke}
                strokeWidth={isDragging || isSelected ? 2 : 1} rx={2} />
              {rw > 24 && rh > 16 && (
                <text x={rx + rw / 2} y={ry + rh / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(9, rw / 6)} fill="#e9d5ff" fontFamily="sans-serif">
                  {p.modulo.nombre.slice(0, 12)}
                </text>
              )}
              {rw > 40 && rh > 28 && (
                <text x={rx + rw / 2} y={ry + rh / 2 + 10} textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fill="#c4b5fd" fontFamily="sans-serif">
                  {Math.round(modAncho)}×{Math.round(modProf)}
                </text>
              )}
            </g>
          )
        })}

        {/* Ghost preview — wall */}
        {placingModule && !isIslandMode && hoverPos !== null && (() => {
          const seg = segments[hoverPos.segIdx]
          const posMm = Math.min(hoverPos.posMm, seg.wall.longitud - (placingModule.ancho || 300))
          const depth = profBase * scale
          const moduleW = (placingModule.ancho || 300) * scale
          const hasOv = overlaps(placements, seg.wall.id, posMm, placingModule.ancho || 300, nivelGroup(nivelForTipo(placingModule.tipoModulo)), undefined, placingModule.tipoModulo)
          const color = hasOv ? '#ef4444' : '#3b82f6'
          let gx: number, gy: number, gw: number, gh: number
          if (seg.cabinetDir === 'down') { gx = seg.x1 + posMm * scale; gy = seg.y1; gw = moduleW; gh = depth }
          else if (seg.cabinetDir === 'up') { gx = seg.x1 + posMm * scale; gy = seg.y1 - depth; gw = moduleW; gh = depth }
          else if (seg.cabinetDir === 'right') { gx = seg.x1; gy = seg.y1 + posMm * scale; gw = depth; gh = moduleW }
          else { gx = seg.x1 - depth; gy = seg.y1 + posMm * scale; gw = depth; gh = moduleW }
          return (
            <g pointerEvents="none">
              <rect x={gx} y={gy} width={gw} height={gh} fill={color} fillOpacity={0.3}
                stroke={color} strokeWidth={1.5} strokeDasharray="5,3" rx={2} />
            </g>
          )
        })()}

        {/* Ghost preview — island */}
        {placingModule && isIslandMode && hoverIsland && (() => {
          const modAncho = (placingModule.ancho || 600) * scale
          const modProf = (placingModule.profundidad || 900) * scale
          const gx = hoverIsland.x - modAncho / 2
          const gy = hoverIsland.y - modProf / 2
          return (
            <g pointerEvents="none">
              <rect x={gx} y={gy} width={modAncho} height={modProf}
                fill="#a855f7" fillOpacity={0.3} stroke="#a855f7" strokeWidth={1.5} strokeDasharray="5,3" rx={2} />
              <text x={hoverIsland.x} y={hoverIsland.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fill="#d8b4fe" fontFamily="sans-serif">
                {Math.round(placingModule.ancho || 600)}×{Math.round(placingModule.profundidad || 900)}
              </text>
            </g>
          )
        })()}

        {/* Walls */}
        {segments.map((s, i) => {
          const isActive = s.wall.id === activeWallId
          const labelX = s.isHoriz ? (s.x1 + s.x2) / 2 : s.x1 + (s.cabinetDir === 'right' ? -14 : 14)
          const labelY = s.isHoriz ? s.y1 - 12 : (s.y1 + s.y2) / 2
          return (
            <g key={i} onClick={(e) => { e.stopPropagation(); onWallClick(s.wall.id) }} className="cursor-pointer">
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={isActive ? '#3b82f6' : '#64748b'}
                strokeWidth={isActive ? wallThick + 2 : wallThick}
                strokeLinecap="square" />
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill={isActive ? '#93c5fd' : '#94a3b8'} fontFamily="sans-serif">
                {s.wall.nombre}{' '}
                <tspan fontSize={8} fill={isActive ? '#60a5fa' : '#64748b'}>{Math.round(s.wall.longitud)}mm</tspan>
              </text>
            </g>
          )
        })}

        {/* Legend */}
        <g transform={`translate(10, ${PLAN_H - 22})`}>
          {Object.entries(NIVEL_COLORS).map(([nivel, c], i) => (
            <g key={nivel} transform={`translate(${i * 72}, 0)`}>
              <rect x={0} y={0} width={10} height={10} fill={c.fill} fillOpacity={0.7} />
              <text x={13} y={8} fontSize={9} fill="#94a3b8" fontFamily="sans-serif">{nivel}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

// ── Nesting Modal ─────────────────────────────────────────────────────────────

function NestingModal({
  calcResults,
  projectName,
  onClose,
}: {
  calcResults: CalcResult[]
  projectName: string
  onClose: () => void
}) {
  const [activeMatIdx, setActiveMatIdx] = useState(0)
  const [activeSheetIdx, setActiveSheetIdx] = useState(0)

  const mat = calcResults[activeMatIdx]
  const sheet = mat?.sheets?.[activeSheetIdx]
  const numSheets = mat?.sheets?.length ?? 0

  // Scale to fit inside ~620px width
  const DISPLAY_W = 620
  const scale = mat ? DISPLAY_W / mat.boardW : 1
  const svgH = mat ? Math.round(mat.boardH * scale) : 400

  function handlePrint() {
    window.print()
  }

  function switchMat(idx: number) {
    setActiveMatIdx(idx)
    setActiveSheetIdx(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 print:bg-white print:p-0 print:fixed print:inset-0">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col print:border-none print:rounded-none print:max-h-none print:max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 print:hidden">
          <div>
            <h3 className="text-foreground font-semibold flex items-center gap-2">
              <Grid2x2 className="w-4 h-4 text-blue-400" />
              Nesting — {projectName}
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              Distribución de piezas en planchas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />Imprimir
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Material tabs */}
        <div className="flex gap-1 px-6 pt-3 flex-shrink-0 border-b border-border overflow-x-auto print:hidden">
          {calcResults.map((r, i) => (
            <button
              key={i}
              onClick={() => switchMat(i)}
              className={cn(
                'px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap border-t border-l border-r',
                activeMatIdx === i
                  ? 'bg-muted border-border text-foreground'
                  : 'bg-transparent border-transparent text-muted-foreground hover:text-muted-foreground/70',
              )}
            >
              {r.tablero}
              <span className="ml-1.5 text-muted-foreground">({r.sheets.length} pl.)</span>
            </button>
          ))}
        </div>

        {/* Sheet navigation + SVG */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Sheet nav */}
          {numSheets > 1 && (
            <div className="flex items-center gap-2 mb-3 print:hidden">
              <button
                onClick={() => setActiveSheetIdx((i) => Math.max(0, i - 1))}
                disabled={activeSheetIdx === 0}
                className="px-2 py-1 bg-muted hover:bg-muted/80 disabled:opacity-40 text-foreground rounded text-xs"
              >
                ← Anterior
              </button>
              <span className="text-muted-foreground text-xs flex-1 text-center">
                Plancha {activeSheetIdx + 1} de {numSheets}
              </span>
              <button
                onClick={() => setActiveSheetIdx((i) => Math.min(numSheets - 1, i + 1))}
                disabled={activeSheetIdx === numSheets - 1}
                className="px-2 py-1 bg-muted hover:bg-muted/80 disabled:opacity-40 text-foreground rounded text-xs"
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* Print: iterate all sheets; screen: show active only */}
          <div className="space-y-6">
            {(mat?.sheets ?? []).map((sh, si) => (
              <div
                key={sh.id}
                className={cn(
                  'print:block print:mb-8 print:page-break-after',
                  si === activeSheetIdx ? 'block' : 'hidden print:block',
                )}
              >
                <p className="text-muted-foreground text-xs mb-2 print:text-black">
                  <span className="font-semibold text-foreground print:text-black">{mat.tablero}</span>
                  {' — '}Plancha {sh.id} / {numSheets}
                  {' · '}{mat.boardW}×{mat.boardH}mm
                  {' · '}{sh.piezas.length} pieza{sh.piezas.length !== 1 ? 's' : ''}
                </p>
                <div className="overflow-x-auto">
                  <svg
                    width={DISPLAY_W}
                    height={svgH + 2}
                    className="block"
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4 }}
                  >
                    {/* Board background */}
                    <rect x={0} y={0} width={DISPLAY_W} height={svgH} fill="#1e293b" />
                    {/* Board border */}
                    <rect x={0} y={0} width={DISPLAY_W} height={svgH} fill="none" stroke="#475569" strokeWidth={1.5} />

                    {sh.piezas.map((p, pi) => {
                      const px = p.x * scale
                      const py = p.y * scale
                      const pw = p.w * scale
                      const ph = p.h * scale
                      const color = NEST_COLORS[p.colorIdx % NEST_COLORS.length]
                      const labelW = Math.round(p.w)
                      const labelH = Math.round(p.h)
                      const labelFit = pw > 30 && ph > 14
                      return (
                        <g key={pi}>
                          <rect
                            x={px}
                            y={py}
                            width={pw}
                            height={ph}
                            fill={color}
                            fillOpacity={0.75}
                            stroke={color}
                            strokeWidth={1}
                            strokeOpacity={1}
                            rx={1}
                          />
                          {labelFit && (
                            <>
                              <text
                                x={px + pw / 2}
                                y={py + ph / 2 - (ph > 26 ? 5 : 0)}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={Math.min(10, pw / 5, ph / 2.5)}
                                fill="#0f172a"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                {p.etiqueta}
                              </text>
                              {ph > 26 && pw > 40 && (
                                <text
                                  x={px + pw / 2}
                                  y={py + ph / 2 + 7}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize={Math.min(8, pw / 7)}
                                  fill="#0f172a"
                                  fontFamily="sans-serif"
                                >
                                  {labelW}×{labelH}
                                </text>
                              )}
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          {mat && mat.sheets.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border print:hidden">
              <p className="text-muted-foreground text-xs mb-2">Leyenda — Plancha {activeSheetIdx + 1}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-36 overflow-y-auto">
                {(sheet?.piezas ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: NEST_COLORS[p.colorIdx % NEST_COLORS.length] }}
                    />
                    <span className="font-mono text-muted-foreground/70 w-12 flex-shrink-0">{p.etiqueta}</span>
                    <span className="text-muted-foreground truncate">{p.nombre} ({Math.round(p.w)}×{Math.round(p.h)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KitchenConfiguratorClient({ project, availableModules }: Props) {
  const router = useRouter()

  const [placements, setPlacements] = useState<Placement[]>(
    project.placements.map((p) => ({
      ...p,
      alturaDesdeSupelo: (p as { alturaDesdeSupelo?: number }).alturaDesdeSupelo ?? DEFAULT_ALTURA,
      posX: (p as { posX?: number }).posX ?? 0,
      posY: (p as { posY?: number }).posY ?? 0,
    }))
  )
  const [activeWallId, setActiveWallId] = useState<number>(project.paredes[0]?.id ?? 0)
  const [view, setView] = useState<'elevation' | 'plan'>('elevation')
  const [placingModule, setPlacingModule] = useState<ModuloBasic | null>(null)
  const [isIslandMode, setIsIslandMode] = useState(false)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState('Todos')
  const [calcResults, setCalcResults] = useState<CalcResult[] | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [elevFlipped, setElevFlipped] = useState(false)
  const [canvasZoom, setCanvasZoom] = useState<number>(() => {
    if (typeof window === 'undefined') return 1
    const saved = parseFloat(localStorage.getItem('cocinas_canvas_zoom') || '1')
    return isNaN(saved) ? 1 : Math.max(0.6, Math.min(2.5, saved))
  })
  const setCanvasZoomPersist = useCallback((z: number) => {
    const clamped = Math.max(0.6, Math.min(2.5, z))
    setCanvasZoom(clamped)
    if (typeof window !== 'undefined') localStorage.setItem('cocinas_canvas_zoom', String(clamped))
  }, [])
  const [positionInput, setPositionInput] = useState('')
  const [alturaInput, setAlturaInput] = useState(String(DEFAULT_ALTURA))
  const [showApuModal, setShowApuModal] = useState(false)
  const [apuNombre, setApuNombre] = useState(project.nombre)
  const [generatingApu, setGeneratingApu] = useState(false)
  const [showCutListModal, setShowCutListModal] = useState(false)
  const [showNestingModal, setShowNestingModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 4000)
  }

  const activeWall = project.paredes.find((w) => w.id === activeWallId) ?? project.paredes[0]
  const wallPlacements = placements
    .filter((p) => p.wallId === activeWallId)
    .sort((a, b) => a.posicion - b.posicion)
  const adjacentWalls = getAdjacentWalls(project.paredes, activeWallId, project.layoutType)
  const totalCalcCost = calcResults?.reduce((s, r) => s + r.costoEstimado, 0) ?? 0

  const filteredModules = availableModules.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tipoModulo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTipo =
      tipoFilter === 'Todos' ||
      (TIPO_FILTER_MAP[tipoFilter] ?? []).some((t) => m.tipoModulo.includes(t)) ||
      (tipoFilter === 'Otro' && !Object.values(TIPO_FILTER_MAP).flat().includes(m.tipoModulo))
    return matchesSearch && matchesTipo
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleModuleSelect(m: ModuloBasic) {
    if (placingModule?.id === m.id && !isIslandMode) {
      setPlacingModule(null)
    } else {
      setPlacingModule(m)
      setIsIslandMode(false)
      setSelectedPlacement(null)
    }
  }

  function handleModuleSelectIsland(m: ModuloBasic) {
    if (placingModule?.id === m.id && isIslandMode) {
      setPlacingModule(null)
      setIsIslandMode(false)
    } else {
      setPlacingModule(m)
      setIsIslandMode(true)
      setSelectedPlacement(null)
      setView('plan') // switch to plan view for island placement
    }
  }

  async function handleCanvasClick(xMm: number) {
    if (!placingModule || !activeWall) return
    const modAncho = placingModule.ancho || 0
    const snapped = Math.round(xMm / SNAP_MM) * SNAP_MM
    const clamped = Math.max(0, Math.min(snapped, activeWall.longitud - modAncho))
    if (modAncho > 0 && clamped + modAncho > activeWall.longitud) {
      showError('El módulo no cabe en esta posición.')
      return
    }
    const ng = nivelGroup(nivelForTipo(placingModule.tipoModulo))
    if (overlaps(placements, activeWallId, clamped, modAncho || 1, ng, undefined, placingModule.tipoModulo)) {
      showError('Hay un módulo en esa posición.')
      return
    }
    await doPlace(activeWallId, clamped)
  }

  async function handleWallPlace(wallId: number, positionMm: number) {
    if (!placingModule) return
    const wall = project.paredes.find((w) => w.id === wallId)
    if (!wall) return
    const modAncho = placingModule.ancho || 0
    const clamped = Math.max(0, Math.min(positionMm, wall.longitud - modAncho))
    const ng = nivelGroup(nivelForTipo(placingModule.tipoModulo))
    if (overlaps(placements, wallId, clamped, modAncho || 1, ng, undefined, placingModule.tipoModulo)) {
      showError('Hay un módulo en esa posición.')
      return
    }
    setActiveWallId(wallId)
    await doPlace(wallId, clamped)
  }

  async function handleIslandPlace(posX: number, posY: number) {
    if (!placingModule) return
    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallId: null,
          moduloId: placingModule.id,
          posicion: 0,
          nivel: 'isla',
          alturaDesdeSupelo: DEFAULT_ALTURA,
          posX,
          posY,
        }),
      })
      if (!res.ok) { showError('Error al colocar la isla.'); return }
      const np = await res.json() as Placement
      setPlacements((prev) => [...prev, { ...np, alturaDesdeSupelo: np.alturaDesdeSupelo ?? DEFAULT_ALTURA, posX: np.posX ?? posX, posY: np.posY ?? posY }])
      setCalcResults(null)
    } catch (err) {
      console.error(err)
      showError('Error de conexión.')
    }
  }

  async function doPlace(wallId: number, posicion: number) {
    if (!placingModule) return
    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallId, moduloId: placingModule.id, posicion, nivel: nivelForTipo(placingModule.tipoModulo), alturaDesdeSupelo: DEFAULT_ALTURA }),
      })
      if (!res.ok) { showError('Error al colocar el módulo.'); return }
      const np = await res.json() as Placement
      setPlacements((prev) => [...prev, { ...np, alturaDesdeSupelo: np.alturaDesdeSupelo ?? DEFAULT_ALTURA, posX: 0, posY: 0 }])
      setCalcResults(null)
    } catch (err) {
      console.error(err)
      showError('Error de conexión.')
    }
  }

  function handlePlacementClick(p: Placement) {
    if (placingModule) return
    setSelectedPlacement(p)
    setPositionInput(String(Math.round(p.posicion)))
    setAlturaInput(String(Math.round(p.alturaDesdeSupelo ?? DEFAULT_ALTURA)))
    if (p.wallId) setActiveWallId(p.wallId)
  }

  async function handleDeletePlacement(pid: number) {
    try {
      await fetch(`/api/cocinas/${project.id}/placements/${pid}`, { method: 'DELETE' })
      setPlacements(placements.filter((p) => p.id !== pid))
      if (selectedPlacement?.id === pid) setSelectedPlacement(null)
      setCalcResults(null)
    } catch (err) { console.error(err) }
  }

  function handlePositionChange(val: string) {
    setPositionInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!selectedPlacement || !activeWall) return
      const newPos = parseFloat(val)
      if (isNaN(newPos)) return
      const clamped = Math.max(0, Math.min(newPos, activeWall.longitud - selectedPlacement.modulo.ancho))
      if (overlaps(placements, selectedPlacement.wallId!, clamped, selectedPlacement.modulo.ancho, nivelGroup(selectedPlacement.nivel), selectedPlacement.id, selectedPlacement.modulo.tipoModulo)) return
      await doPatch(selectedPlacement.id, { posicion: clamped })
    }, 600)
  }

  function handleAlturaChange(val: string) {
    setAlturaInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!selectedPlacement) return
      const n = parseFloat(val)
      if (isNaN(n) || n < 0) return
      await doPatch(selectedPlacement.id, { alturaDesdeSupelo: n })
    }, 600)
  }

  async function handleNivelChange(nivel: string) {
    if (!selectedPlacement) return
    await doPatch(selectedPlacement.id, { nivel })
  }

  async function doPatch(id: number, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return
      const updated = await res.json() as Placement
      const merged: Placement = { ...updated, alturaDesdeSupelo: updated.alturaDesdeSupelo ?? DEFAULT_ALTURA, posX: updated.posX ?? 0, posY: updated.posY ?? 0 }
      setPlacements((prev) => prev.map((p) => (p.id === id ? merged : p)))
      if (selectedPlacement?.id === id) setSelectedPlacement(merged)
      setCalcResults(null)
    } catch (err) { console.error(err) }
  }

  async function handleElevDragEnd(placementId: number, newPos: number, targetWall?: Wall) {
    const p = placements.find((x) => x.id === placementId)
    if (!p) return
    const data: Record<string, unknown> = { posicion: newPos }
    if (targetWall && targetWall.id !== p.wallId) {
      data.wallId = targetWall.id
      setActiveWallId(targetWall.id)
    }
    await doPatch(placementId, data)
  }

  async function handlePlanDragEnd(id: number, newPosicion?: number, newPosX?: number, newPosY?: number) {
    if (newPosX !== undefined && newPosY !== undefined) {
      await doPatch(id, { posX: newPosX, posY: newPosY })
    } else if (newPosicion !== undefined) {
      await doPatch(id, { posicion: newPosicion })
    }
  }

  const handleCalcular = useCallback(async () => {
    setCalculating(true)
    try {
      const res = await fetch(`/api/cocinas/${project.id}/calcular`, { method: 'POST' })
      if (!res.ok) return
      setCalcResults(await res.json() as CalcResult[])
      setSelectedPlacement(null)
    } finally { setCalculating(false) }
  }, [project.id])

  async function handleGenerarApu() {
    setGeneratingApu(true)
    try {
      const res = await fetch(`/api/cocinas/${project.id}/apu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: apuNombre }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError(err.error || 'Error al crear APU')
        return
      }
      const data = await res.json() as { apuId: number }
      router.push(`/apus/${data.apuId}`)
    } finally { setGeneratingApu(false); setShowApuModal(false) }
  }

  function buildCutListText(): string {
    if (!calcResults) return ''
    const T = '\t'
    const header = ['Length', 'Width', 'Quantity', 'Material', 'Texture', 'Label',
      'Edgebands', 'Edgebands', 'Edgebands', 'Edgebands', 'Customer'].join(T)
    const rows: string[] = [header]

    for (const r of calcResults) {
      for (const p of r.piezas) {
        // decode tapacanto: sides + optional _color:xxx
        const tc = Array.isArray(p.tapacanto) ? p.tapacanto : []
        const colorEntry = tc.find((s) => s.startsWith('_color:'))
        const cantoVal = colorEntry ? colorEntry.slice(7) : (tc.some((s) => ['superior','inferior','izquierdo','derecho'].includes(s)) ? '1' : '')
        const eb1 = tc.includes('superior')  ? cantoVal : ''  // Top
        const eb2 = tc.includes('inferior')  ? cantoVal : ''  // Bottom
        const eb3 = tc.includes('izquierdo') ? cantoVal : ''  // Left
        const eb4 = tc.includes('derecho')   ? cantoVal : ''  // Right

        // Expand by quantity — one row per individual piece for CNC
        for (let i = 0; i < p.cantidad; i++) {
          rows.push([
            Math.round(p.largo),
            Math.round(p.ancho),
            1,
            r.tablero,
            '',                        // Texture
            `${p.etiqueta} ${p.nombre}`,
            eb1, eb2, eb3, eb4,
            project.nombre,
          ].join(T))
        }
      }
    }

    return rows.join('\n')
  }

  async function handleCopyText() {
    const text = buildCutListText()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const text = buildCutListText()
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cortes-${project.nombre.replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setPlacingModule(null); setIsIslandMode(false); setHoverX(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#0b0f1a]" onKeyDown={handleKeyDown} tabIndex={-1} style={{ outline: 'none' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <Link href="/cocinas" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-foreground font-semibold text-sm truncate">{project.nombre}</h1>
          <p className="text-muted-foreground text-xs">{placements.length} módulo{placements.length !== 1 ? 's' : ''} colocado{placements.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          <button onClick={() => setView('elevation')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', view === 'elevation' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutPanelLeft className="w-3.5 h-3.5" />Elevación
          </button>
          <button onClick={() => setView('plan')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', view === 'plan' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground')}>
            <Map className="w-3.5 h-3.5" />Planta
          </button>
        </div>
        <button onClick={handleCalcular} disabled={calculating || placements.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors">
          <Calculator className="w-3.5 h-3.5" />
          {calculating ? 'Calculando...' : 'Calcular'}
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-card/50">
          <div className="p-3 space-y-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar módulos..."
                className="w-full pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(TIPO_FILTER_MAP).map((f) => (
                <button key={f} onClick={() => setTipoFilter(f)}
                  className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors', tipoFilter === f ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {placingModule && (
            <div className={cn('px-3 py-2 border-b text-xs flex items-center justify-between',
              isIslandMode ? 'bg-purple-900/30 border-purple-500/20 text-purple-300' : 'bg-blue-900/30 border-blue-500/20 text-blue-300')}>
              <span className="flex items-center gap-1.5">
                {isIslandMode && <Layers className="w-3 h-3" />}
                {isIslandMode ? 'Modo isla — clic en planta' : 'ESC para cancelar'}
              </span>
              <button onClick={() => { setPlacingModule(null); setIsIslandMode(false) }}><X className="w-3 h-3" /></button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredModules.length === 0 ? (
              <p className="text-muted-foreground text-xs text-center py-8">Sin módulos</p>
            ) : (
              filteredModules.map((m) => {
                const isWallActive = placingModule?.id === m.id && !isIslandMode
                const isIslandActive = placingModule?.id === m.id && isIslandMode
                return (
                  <div key={m.id} className={cn('rounded-lg border transition-colors',
                    isWallActive ? 'border-blue-500 bg-blue-900/30' : isIslandActive ? 'border-purple-500 bg-purple-900/30' : 'border-border bg-muted/40 hover:border-border hover:bg-muted')}>
                    <div className="p-2.5">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-xs font-medium truncate">{m.nombre}</p>
                          <p className="text-muted-foreground text-xs mt-0.5 truncate">{m.tipoModulo}</p>
                          {m.ancho > 0 && m.alto > 0 ? (
                            <p className="text-muted-foreground text-xs">{Math.round(m.ancho)}×{Math.round(m.alto)}×{Math.round(m.profundidad)} mm</p>
                          ) : (
                            <p className="text-amber-500 text-xs">⚠ Sin dimensiones</p>
                          )}
                        </div>
                        {m.colorAcabado && (
                          <div className="w-4 h-4 rounded border border-border flex-shrink-0 mt-0.5" style={{ background: m.colorAcabado }} />
                        )}
                      </div>
                      {/* Placement buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleModuleSelect(m)}
                          className={cn('flex-1 py-1 rounded text-xs font-medium transition-colors',
                            isWallActive ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground/70 hover:bg-muted/80')}
                          title="Colocar en pared"
                        >
                          Pared
                        </button>
                        <button
                          onClick={() => handleModuleSelectIsland(m)}
                          className={cn('flex-1 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1',
                            isIslandActive ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground/70 hover:bg-muted/80')}
                          title="Colocar como isla / península"
                        >
                          <Layers className="w-3 h-3" />Isla
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {view === 'elevation' ? (
            <>
              <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border flex-shrink-0">
                {project.paredes.map((wall) => (
                  <button key={wall.id} onClick={() => setActiveWallId(wall.id)}
                    className={cn('px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors border-t border-l border-r',
                      activeWallId === wall.id ? 'bg-muted border-border text-foreground' : 'bg-transparent border-transparent text-muted-foreground hover:text-muted-foreground/70')}>
                    Pared {wall.nombre}
                    <span className="ml-1.5 text-muted-foreground">{Math.round(wall.longitud)}mm</span>
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex items-center gap-0.5 bg-muted/30 rounded-md border border-border">
                    <button
                      onClick={() => setCanvasZoomPersist(canvasZoom - 0.15)}
                      disabled={canvasZoom <= 0.6}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                      title="Reducir zoom"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setCanvasZoomPersist(1)}
                      className="px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground font-mono min-w-[36px]"
                      title="Restablecer zoom (100%)"
                    >
                      {Math.round(canvasZoom * 100)}%
                    </button>
                    <button
                      onClick={() => setCanvasZoomPersist(canvasZoom + 0.15)}
                      disabled={canvasZoom >= 2.5}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                      title="Aumentar zoom"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => setElevFlipped(!elevFlipped)}
                    className={cn('px-2 py-1.5 rounded-t-lg text-xs font-medium transition-colors border-t border-l border-r',
                      elevFlipped ? 'bg-amber-900/40 border-amber-600/40 text-amber-300' : 'bg-transparent border-transparent text-muted-foreground hover:text-muted-foreground/70')}
                    title="Invertir dirección de la vista de elevación"
                  >
                    {elevFlipped ? '← Der a Izq' : 'Izq a Der →'}
                  </button>
                </div>
              </div>

              {placingModule && !isIslandMode && (
                <div className="px-4 py-2 bg-blue-900/20 border-b border-blue-500/10 text-xs text-blue-300 flex items-center gap-2 flex-shrink-0">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse inline-block" />
                  Colocando en Pared {activeWall?.nombre}: clic para colocar <strong>{placingModule.nombre}</strong> ({Math.round(placingModule.ancho)}mm)
                </div>
              )}

              <div className="flex-1 overflow-auto p-4">
                {errorMsg && (
                  <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />{errorMsg}
                  </div>
                )}
                {activeWall ? (
                  <ElevationSVG
                    wall={activeWall}
                    placements={wallPlacements}
                    allPlacements={placements}
                    alturaMm={project.alturaMm}
                    selectedPlacementId={selectedPlacement?.id ?? null}
                    placingModule={isIslandMode ? null : placingModule}
                    hoverX={hoverX}
                    flipped={elevFlipped}
                    adjacentAtStart={adjacentWalls.atStart}
                    adjacentAtEnd={adjacentWalls.atEnd}
                    zoom={canvasZoom}
                    onCanvasClick={handleCanvasClick}
                    onCanvasMouseMove={setHoverX}
                    onCanvasMouseLeave={() => setHoverX(null)}
                    onPlacementClick={handlePlacementClick}
                    onDragEnd={handleElevDragEnd}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">Sin paredes configuradas</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {errorMsg && (
                <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />{errorMsg}
                </div>
              )}
              {placingModule && (
                <div className={cn('mb-3 px-3 py-2 border rounded-lg text-xs flex items-center gap-2',
                  isIslandMode ? 'bg-purple-900/20 border-purple-500/10 text-purple-300' : 'bg-blue-900/20 border-blue-500/10 text-blue-300')}>
                  <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: isIslandMode ? '#a855f7' : '#60a5fa' }} />
                  {isIslandMode
                    ? <>Haz clic en el espacio libre para colocar <strong>{placingModule.nombre}</strong> como isla</>
                    : <>Haz clic en <strong>Pared {project.paredes.find((w) => w.id === activeWallId)?.nombre}</strong> para colocar <strong>{placingModule.nombre}</strong></>
                  }
                </div>
              )}
              <InteractivePlanSVG
                walls={project.paredes}
                placements={placements}
                layoutType={project.layoutType}
                profBase={project.profBase}
                activeWallId={activeWallId}
                onWallClick={setActiveWallId}
                placingModule={placingModule}
                isIslandMode={isIslandMode}
                selectedPlacementId={selectedPlacement?.id ?? null}
                onWallPlace={handleWallPlace}
                onIslandPlace={handleIslandPlace}
                onPlacementClick={handlePlacementClick}
                onPlanDragEnd={handlePlanDragEnd}
              />
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-72 flex-shrink-0 border-l border-border flex flex-col bg-card/50">
          {selectedPlacement ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground font-semibold text-sm">Módulo seleccionado</h3>
                <button onClick={() => setSelectedPlacement(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-foreground text-sm font-medium">{selectedPlacement.modulo.nombre}</p>
                <p className="text-muted-foreground text-xs">{selectedPlacement.modulo.tipoModulo}</p>
                <p className="text-muted-foreground text-xs">
                  {Math.round(selectedPlacement.modulo.ancho)}×{Math.round(selectedPlacement.modulo.alto)}×{Math.round(selectedPlacement.modulo.profundidad)} mm
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium mb-1">Ubicación</p>
                <p className="text-foreground text-sm">
                  {selectedPlacement.nivel === 'isla'
                    ? 'Isla / Península'
                    : `Pared ${project.paredes.find((w) => w.id === selectedPlacement.wallId)?.nombre ?? '-'}`}
                </p>
              </div>

              {selectedPlacement.nivel !== 'isla' && (
                <div>
                  <label className="block text-muted-foreground text-xs font-medium mb-1">Posición (mm desde inicio)</label>
                  <input type="number" value={positionInput} onChange={(e) => handlePositionChange(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-xs font-medium mb-1">Nivel</p>
                <div className="flex gap-1 flex-wrap">
                  {(['base', 'alto', 'torre'] as const).map((n) => (
                    <button key={n} onClick={() => handleNivelChange(n)}
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize min-w-0',
                        selectedPlacement.nivel === n ? NIVEL_COLORS[n].badge : 'bg-muted text-muted-foreground hover:text-foreground')}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => handleNivelChange('isla')}
                    className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-0',
                      selectedPlacement.nivel === 'isla' ? NIVEL_COLORS.isla.badge : 'bg-muted text-muted-foreground hover:text-foreground')}>
                    isla
                  </button>
                </div>
              </div>

              {selectedPlacement.nivel === 'alto' && (
                <div>
                  <label className="block text-muted-foreground text-xs font-medium mb-1">Altura desde el suelo (mm)</label>
                  <input type="number" value={alturaInput} onChange={(e) => handleAlturaChange(e.target.value)}
                    placeholder="1400"
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  <p className="text-muted-foreground text-xs mt-1">Parte inferior del módulo aéreo</p>
                </div>
              )}

              <button onClick={() => handleDeletePlacement(selectedPlacement.id)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-sm font-medium transition-colors">
                <Trash2 className="w-4 h-4" />Eliminar módulo
              </button>
            </div>
          ) : calcResults ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-border">
                <h3 className="text-foreground font-semibold text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-400" />Materiales necesarios
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {calcResults.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Sin piezas para calcular.</p>
                ) : calcResults.map((r, i) => {
                  const totalPiezas = r.piezas.reduce((s, p) => s + p.cantidad, 0)
                  return (
                    <div key={i} className="bg-muted/50 border border-border rounded-lg p-3 space-y-1.5">
                      <p className="text-foreground text-xs font-semibold truncate">{r.tablero}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        <span className="text-muted-foreground text-xs">Plancha</span>
                        <span className="text-foreground text-xs font-medium">{r.boardW}×{r.boardH}mm</span>
                        <span className="text-muted-foreground text-xs">Cantidad</span>
                        <span className="text-foreground text-xs font-medium">{r.numPlanchas} plancha{r.numPlanchas !== 1 ? 's' : ''}</span>
                        <span className="text-muted-foreground text-xs">Aprovech.</span>
                        <span className={cn('text-xs font-medium', r.aprovechamiento >= 70 ? 'text-emerald-400' : r.aprovechamiento >= 50 ? 'text-amber-400' : 'text-red-400')}>
                          {r.aprovechamiento.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground text-xs">Piezas</span>
                        <span className="text-foreground text-xs font-medium">{totalPiezas} cortes</span>
                      </div>
                    </div>
                  )
                })}
                {calcResults.length > 0 && (
                  <div className="border-t border-border pt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Total piezas</span>
                      <span className="text-foreground text-xs font-medium">
                        {calcResults.reduce((s, r) => s + r.piezas.reduce((ss, p) => ss + p.cantidad, 0), 0)} cortes
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Costo estimado</span>
                      <span className="text-emerald-400 text-xs font-bold">{formatCurrency(totalCalcCost)}</span>
                    </div>
                  </div>
                )}
              </div>
              {calcResults.length > 0 && (
                <div className="p-4 border-t border-border space-y-2">
                  <button onClick={() => setShowCutListModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                    <ClipboardList className="w-4 h-4" />Ver lista de cortes
                  </button>
                  <button onClick={() => setShowNestingModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
                    <Grid2x2 className="w-4 h-4" />Ver nesting
                  </button>
                  <button onClick={() => setShowApuModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-muted hover:bg-muted/80 text-muted-foreground/70 rounded-lg text-sm font-medium transition-colors">
                    <FileText className="w-4 h-4" />Crear APU
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <LayoutPanelLeft className="w-10 h-10 text-foreground mb-3" />
              <p className="text-muted-foreground text-sm font-medium">Panel de propiedades</p>
              <p className="text-muted-foreground text-xs mt-1">
                Selecciona un módulo → botón <strong className="text-muted-foreground">Pared</strong> o <strong className="text-muted-foreground">Isla</strong> para colocarlo.
              </p>
              {placements.length > 0 && (
                <button onClick={handleCalcular} disabled={calculating}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/20 rounded-lg text-sm transition-colors">
                  <Calculator className="w-4 h-4" />
                  {calculating ? 'Calculando...' : 'Calcular materiales'}
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Cut list modal */}
      {showCutListModal && calcResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h3 className="text-foreground font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-400" />
                  Orden de cortes — {project.nombre}
                </h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {calcResults.reduce((s, r) => s + r.piezas.reduce((ss, p) => ss + p.cantidad, 0), 0)} piezas en {calcResults.reduce((s, r) => s + r.numPlanchas, 0)} plancha{calcResults.reduce((s, r) => s + r.numPlanchas, 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground/70 rounded-lg text-xs font-medium transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors">
                  <FileText className="w-3.5 h-3.5" />Descargar .txt
                </button>
                <button onClick={() => setShowCutListModal(false)} className="text-muted-foreground hover:text-foreground ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {calcResults.map((r, ri) => (
                <div key={ri}>
                  {/* Material header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1">
                      <p className="text-foreground font-semibold text-sm">{r.tablero}</p>
                      <p className="text-muted-foreground text-xs">
                        {r.numPlanchas} plancha{r.numPlanchas !== 1 ? 's' : ''} {r.boardW}×{r.boardH}mm
                        {' · '}
                        <span className={cn(r.aprovechamiento >= 70 ? 'text-emerald-400' : r.aprovechamiento >= 50 ? 'text-amber-400' : 'text-red-400')}>
                          {r.aprovechamiento.toFixed(1)}% aprovechamiento
                        </span>
                        {' · '}
                        {r.piezas.reduce((s, p) => s + p.cantidad, 0)} piezas
                      </p>
                    </div>
                  </div>

                  {/* Cut table */}
                  {r.piezas.length === 0 ? (
                    <p className="text-muted-foreground text-xs italic">Sin piezas definidas en los módulos de este material.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">#</th>
                            <th className="px-3 py-2 text-left font-medium">Etiqueta</th>
                            <th className="px-3 py-2 text-left font-medium">Nombre</th>
                            <th className="px-3 py-2 text-right font-medium">Largo</th>
                            <th className="px-3 py-2 text-right font-medium">Ancho</th>
                            <th className="px-3 py-2 text-right font-medium">Cant.</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Módulo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.piezas.map((p, pi) => (
                            <tr key={pi} className={cn('border-t border-border/50', pi % 2 === 0 ? 'bg-card' : 'bg-muted/30')}>
                              <td className="px-3 py-1.5 text-muted-foreground">{pi + 1}</td>
                              <td className="px-3 py-1.5 font-mono text-emerald-400">{p.etiqueta}</td>
                              <td className="px-3 py-1.5 text-foreground">{p.nombre}</td>
                              <td className="px-3 py-1.5 text-right text-foreground font-mono">{Math.round(p.largo)}</td>
                              <td className="px-3 py-1.5 text-right text-foreground font-mono">{Math.round(p.ancho)}</td>
                              <td className="px-3 py-1.5 text-right text-foreground font-semibold">{p.cantidad}</td>
                              <td className="px-3 py-1.5 text-muted-foreground text-xs truncate max-w-[120px]">{p.modulo}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted">
                            <td colSpan={5} className="px-3 py-2 text-muted-foreground text-xs font-medium">Total</td>
                            <td className="px-3 py-2 text-right text-foreground font-bold">
                              {r.piezas.reduce((s, p) => s + p.cantidad, 0)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nesting modal */}
      {showNestingModal && calcResults && (
        <NestingModal
          calcResults={calcResults}
          projectName={project.nombre}
          onClose={() => setShowNestingModal(false)}
        />
      )}

      {/* APU modal */}
      {showApuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold">Crear APU del mueble</h3>
              <button onClick={() => setShowApuModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-muted-foreground text-xs">
              Se creará un APU en el catálogo con el nombre del mueble y una línea por cada módulo único.
              Después puedes arrastrarlo a una cotización desde el constructor de presupuestos.
            </p>
            <div>
              <label className="block text-muted-foreground/70 text-sm font-medium mb-1">Nombre del APU</label>
              <input type="text" value={apuNombre} onChange={(e) => setApuNombre(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Costo estimado</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(totalCalcCost)}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowApuModal(false)}
                className="flex-1 py-2 bg-muted hover:bg-muted/80 text-muted-foreground/70 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleGenerarApu} disabled={generatingApu}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {generatingApu ? 'Creando...' : 'Crear APU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
