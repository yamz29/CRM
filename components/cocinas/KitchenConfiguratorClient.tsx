'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calculator, LayoutPanelLeft, Map, Search, X,
  Trash2, FileText,
} from 'lucide-react'
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
  wallId: number
  moduloId: number
  posicion: number
  nivel: string
  alturaDesdeSupelo: number
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

interface CalcResult {
  tablero: string
  boardW: number
  boardH: number
  numPlanchas: number
  aprovechamiento: number
  costoEstimado: number
  piezaTotal: number
  sheetTotal: number
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
}

const SNAP_MM = 50
const CANVAS_HEIGHT_PX = 380
const COUNTERTOP_MM = 850
const DEFAULT_ALTURA_DESDE_SUELO = 1400

const TIPO_FILTER_MAP: Record<string, string[]> = {
  Todos: [],
  Base: ['Base con puertas', 'Base con cajones', 'Base mixto'],
  Aéreo: ['Aéreo con puertas'],
  Torre: ['Columna', 'Torre'],
  'Electrod.': ['Electrodoméstico'],
  Otro: ['Closet', 'Baño', 'Oficina', 'Otro'],
}

// ── Collision detection ───────────────────────────────────────────────────────

function overlaps(
  existingPlacements: Placement[],
  wallId: number,
  newPos: number,
  newWidth: number,
  excludeId?: number,
): boolean {
  return existingPlacements
    .filter((p) => p.wallId === wallId && p.id !== excludeId)
    .some((p) => {
      const pEnd = p.posicion + p.modulo.ancho
      const newEnd = newPos + newWidth
      return newPos < pEnd && newEnd > p.posicion
    })
}

// ── Wall adjacency ────────────────────────────────────────────────────────────

function getAdjacentWalls(
  walls: Wall[],
  wallId: number,
  layoutType: string,
): { atStart: Wall | null; atEnd: Wall | null } {
  if (!walls.length) return { atStart: null, atEnd: null }
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
  // U layout: A=top horizontal, B=left vertical, C=right vertical
  const [wA, wB, wC] = walls
  if (wallId === wA?.id) return { atStart: wB ?? null, atEnd: wC ?? null }
  if (wallId === wB?.id) return { atStart: null, atEnd: wA ?? null }
  if (wallId === wC?.id) return { atStart: null, atEnd: wA ?? null }
  return { atStart: null, atEnd: null }
}

// ── Plan segment computation ──────────────────────────────────────────────────

type PlanSegment = {
  x1: number; y1: number; x2: number; y2: number
  wall: Wall
  cabinetDir: 'down' | 'up' | 'right' | 'left'
  isHoriz: boolean
}

function computeSegments(
  walls: Wall[],
  layoutType: string,
  scale: number,
  padX: number,
  padY: number,
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
    // U
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
  wall,
  placements,
  allPlacements,
  alturaMm,
  selectedPlacementId,
  placingModule,
  hoverX,
  adjacentAtStart,
  adjacentAtEnd,
  onCanvasClick,
  onCanvasMouseMove,
  onCanvasMouseLeave,
  onPlacementClick,
  onDragEnd,
}: {
  wall: Wall
  placements: Placement[]
  allPlacements: Placement[]
  alturaMm: number
  selectedPlacementId: number | null
  placingModule: ModuloBasic | null
  hoverX: number | null
  adjacentAtStart: Wall | null
  adjacentAtEnd: Wall | null
  onCanvasClick: (xMm: number) => void
  onCanvasMouseMove: (xMm: number) => void
  onCanvasMouseLeave: () => void
  onPlacementClick: (placement: Placement) => void
  onDragEnd: (placementId: number, newPosicion: number, targetWall?: Wall) => void
}) {
  const scale = CANVAS_HEIGHT_PX / alturaMm
  const svgWidth = Math.max(wall.longitud * scale, 400)
  const yFloor = CANVAS_HEIGHT_PX
  const yCountertop = yFloor - COUNTERTOP_MM * scale

  const [dragState, setDragState] = useState<{
    id: number
    startClientX: number
    startPosicion: number
    currentPosicion: number
  } | null>(null)

  const rulerTicks: number[] = []
  for (let mm = 0; mm <= wall.longitud; mm += 500) rulerTicks.push(mm)
  const gridLines: number[] = []
  for (let mm = 0; mm <= wall.longitud; mm += 600) gridLines.push(mm)

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (dragState) return
    const rect = e.currentTarget.getBoundingClientRect()
    onCanvasClick((e.clientX - rect.left) / scale)
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (dragState) {
      const dMm = (e.clientX - dragState.startClientX) / scale
      setDragState((prev) => prev ? { ...prev, currentPosicion: prev.startPosicion + dMm } : null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      onCanvasMouseMove((e.clientX - rect.left) / scale)
    }
  }

  function handleSvgMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragState) return
    const dMm = (e.clientX - dragState.startClientX) / scale
    const raw = dragState.startPosicion + dMm
    const p = allPlacements.find((x) => x.id === dragState.id)
    if (p) {
      const moduleAncho = p.modulo.ancho || 300
      let targetWall: Wall | undefined
      let finalPosicion: number
      if (raw < 0 && adjacentAtStart) {
        finalPosicion = Math.max(0, adjacentAtStart.longitud - moduleAncho)
        targetWall = adjacentAtStart
      } else if (raw + moduleAncho > wall.longitud && adjacentAtEnd) {
        finalPosicion = 0
        targetWall = adjacentAtEnd
      } else {
        const snapped = Math.round(raw / SNAP_MM) * SNAP_MM
        finalPosicion = Math.max(0, Math.min(snapped, wall.longitud - moduleAncho))
        if (overlaps(allPlacements, wall.id, finalPosicion, moduleAncho, dragState.id)) {
          finalPosicion = dragState.startPosicion
        }
      }
      onDragEnd(dragState.id, finalPosicion, targetWall)
    }
    setDragState(null)
  }

  const draggingP = dragState ? allPlacements.find((p) => p.id === dragState.id) : null

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={CANVAS_HEIGHT_PX + 24}
        className={cn(
          'block select-none',
          placingModule ? 'cursor-crosshair' : dragState ? 'cursor-grabbing' : 'cursor-default',
        )}
        onClick={handleSvgClick}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={() => {
          if (dragState) { onDragEnd(dragState.id, dragState.startPosicion); setDragState(null) }
          else onCanvasMouseLeave()
        }}
        onMouseUp={handleSvgMouseUp}
      >
        {/* Background */}
        <rect x={0} y={0} width={svgWidth} height={CANVAS_HEIGHT_PX + 24} fill="#0f172a" />

        {/* Grid */}
        {gridLines.map((mm) => (
          <line key={`g-${mm}`} x1={mm * scale} y1={0} x2={mm * scale} y2={CANVAS_HEIGHT_PX} stroke="#1e293b" strokeWidth={1} />
        ))}

        {/* Countertop reference */}
        <line x1={0} y1={yCountertop} x2={svgWidth} y2={yCountertop} stroke="#64748b" strokeWidth={1} strokeDasharray="6,4" />
        <text x={4} y={yCountertop - 3} fill="#64748b" fontSize={9}>Muestrario 850mm</text>

        {/* Floor */}
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
            const altBottom = p.alturaDesdeSupelo || DEFAULT_ALTURA_DESDE_SUELO
            rectH = modAlto * scale
            rectY = yFloor - (altBottom + modAlto) * scale
          } else {
            rectH = modAlto * scale
            rectY = yFloor - rectH
          }

          const rectX = currentPos * scale
          const rectW = Math.max(modAncho * scale, 8)
          const isSelected = p.id === selectedPlacementId

          return (
            <g
              key={p.id}
              onClick={(e) => {
                if (!dragState || Math.abs(e.clientX - (dragState?.startClientX ?? 0)) < 5) {
                  e.stopPropagation()
                  onPlacementClick(p)
                }
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
                <text
                  x={rectX + rectW / 2} y={rectY + rectH / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(10, rectW / 7, rectH / 2.5)}
                  fill="#ffffff" fontFamily="sans-serif"
                >
                  {rectW > 60 ? p.modulo.nombre.slice(0, 14) : p.modulo.nombre.slice(0, 4)}
                </text>
              )}
              {rectW > 30 && rectH > 28 && (
                <text
                  x={rectX + rectW / 2} y={rectY + rectH / 2 + 10}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={8} fill="#cbd5e1" fontFamily="sans-serif"
                >
                  {Math.round(modAncho)}×{Math.round(modAlto)}
                </text>
              )}
            </g>
          )
        })}

        {/* Ghost preview when placing */}
        {placingModule && hoverX !== null && (() => {
          const snapped = Math.round(hoverX / SNAP_MM) * SNAP_MM
          const clamped = Math.max(0, Math.min(snapped, wall.longitud - (placingModule.ancho || 300)))
          const hasOverlap = overlaps(allPlacements, wall.id, clamped, placingModule.ancho || 300)
          const rectW = Math.max((placingModule.ancho || 300) * scale, 40)
          const rectH = Math.max((placingModule.alto || 720) * scale, 30)
          const rectX = clamped * scale
          const rectY = yFloor - rectH
          const color = hasOverlap ? '#ef4444' : '#3b82f6'
          return (
            <g pointerEvents="none">
              <rect x={rectX} y={rectY} width={rectW} height={rectH} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} strokeDasharray="5,3" rx={2} />
              <text x={rectX + rectW / 2} y={rectY + rectH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={color} fontFamily="sans-serif">
                {placingModule.ancho ? `${Math.round(placingModule.ancho)}mm` : '?mm'}
              </text>
            </g>
          )
        })()}

        {/* Jump indicators when dragging near edges */}
        {draggingP && dragState && (() => {
          const moduleAncho = draggingP.modulo.ancho || 300
          const nearLeft = dragState.currentPosicion < 0 && adjacentAtStart
          const nearRight = dragState.currentPosicion + moduleAncho > wall.longitud && adjacentAtEnd
          return (
            <>
              {nearLeft && (
                <g pointerEvents="none">
                  <rect x={0} y={0} width={70} height={CANVAS_HEIGHT_PX} fill="#f59e0b" fillOpacity={0.1} />
                  <text x={35} y={CANVAS_HEIGHT_PX / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#f59e0b" fontFamily="sans-serif">← {adjacentAtStart.nombre}</text>
                </g>
              )}
              {nearRight && (
                <g pointerEvents="none">
                  <rect x={svgWidth - 70} y={0} width={70} height={CANVAS_HEIGHT_PX} fill="#f59e0b" fillOpacity={0.1} />
                  <text x={svgWidth - 35} y={CANVAS_HEIGHT_PX / 2} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#f59e0b" fontFamily="sans-serif">{adjacentAtEnd.nombre} →</text>
                </g>
              )}
            </>
          )
        })()}

        {/* Ruler */}
        <rect x={0} y={CANVAS_HEIGHT_PX} width={svgWidth} height={24} fill="#1e293b" />
        {rulerTicks.map((mm) => (
          <g key={`r-${mm}`}>
            <line x1={mm * scale} y1={CANVAS_HEIGHT_PX} x2={mm * scale} y2={CANVAS_HEIGHT_PX + (mm % 1000 === 0 ? 8 : 5)} stroke="#475569" strokeWidth={1} />
            {mm % 500 === 0 && (
              <text x={mm * scale} y={CANVAS_HEIGHT_PX + 18} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">{mm}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Interactive Plan SVG ──────────────────────────────────────────────────────

function InteractivePlanSVG({
  walls,
  placements,
  layoutType,
  profBase,
  activeWallId,
  onWallClick,
  placingModule,
  selectedPlacementId,
  onPlanPlace,
  onPlacementClick,
  onPlanDragEnd,
}: {
  walls: Wall[]
  placements: Placement[]
  layoutType: string
  profBase: number
  activeWallId: number
  onWallClick: (wallId: number) => void
  placingModule: ModuloBasic | null
  selectedPlacementId: number | null
  onPlanPlace: (wallId: number, positionMm: number) => void
  onPlacementClick: (p: Placement) => void
  onPlanDragEnd: (placementId: number, newPosicion: number) => void
}) {
  const PLAN_W = 580
  const PLAN_H = 380

  if (!walls.length) {
    return (
      <div className="flex items-center justify-center h-[340px] bg-slate-900 rounded-lg text-slate-600 text-sm">
        Sin paredes configuradas
      </div>
    )
  }

  const maxLen = Math.max(...walls.map((w) => w.longitud), 1000)
  const scale = Math.min(PLAN_W * 0.65, PLAN_H * 0.65) / maxLen
  const padX = 70, padY = 70
  const wallThick = 8

  const segments = computeSegments(walls, layoutType, scale, padX, padY)

  const [hoverSeg, setHoverSeg] = useState<{ idx: number; posMm: number } | null>(null)
  const [planDrag, setPlanDrag] = useState<{
    placementId: number
    segIdx: number
    startClientX: number
    startClientY: number
    startPosicion: number
    currentPosicion: number
  } | null>(null)

  function getPosOnSeg(seg: PlanSegment, clientX: number, clientY: number, svgRect: DOMRect): number {
    const mx = clientX - svgRect.left
    const my = clientY - svgRect.top
    if (seg.isHoriz) return (mx - seg.x1) / scale
    return (my - seg.y1) / scale
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - svgRect.left
    const my = e.clientY - svgRect.top

    if (planDrag) {
      const seg = segments[planDrag.segIdx]
      const dMm = seg.isHoriz
        ? (e.clientX - planDrag.startClientX) / scale
        : (e.clientY - planDrag.startClientY) / scale
      setPlanDrag((prev) => prev ? { ...prev, currentPosicion: prev.startPosicion + dMm } : null)
      return
    }

    if (!placingModule) { setHoverSeg(null); return }

    // Find which segment the mouse is hovering over (within cabinet depth band)
    const depth = profBase * scale
    let found: { idx: number; posMm: number } | null = null
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (seg.isHoriz) {
        const yMin = seg.y1, yMax = seg.y1 + depth
        if (my >= yMin - 4 && my <= yMax + depth && mx >= seg.x1 && mx <= seg.x2) {
          found = { idx: i, posMm: Math.max(0, Math.round(((mx - seg.x1) / scale) / SNAP_MM) * SNAP_MM) }
          break
        }
      } else {
        const x = seg.x1
        const xMin = seg.cabinetDir === 'right' ? x : x - depth
        const xMax = seg.cabinetDir === 'right' ? x + depth : x
        if (mx >= xMin - 4 && mx <= xMax + 4 && my >= seg.y1 && my <= seg.y2) {
          found = { idx: i, posMm: Math.max(0, Math.round(((my - seg.y1) / scale) / SNAP_MM) * SNAP_MM) }
          break
        }
      }
    }
    setHoverSeg(found)
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (planDrag) return
    if (placingModule && hoverSeg !== null) {
      onPlanPlace(segments[hoverSeg.idx].wall.id, hoverSeg.posMm)
    }
  }

  function handleSvgMouseUp() {
    if (!planDrag) return
    const seg = segments[planDrag.segIdx]
    const p = placements.find((x) => x.id === planDrag.placementId)
    if (p) {
      const moduleAncho = p.modulo.ancho || 300
      const snapped = Math.round(planDrag.currentPosicion / SNAP_MM) * SNAP_MM
      const clamped = Math.max(0, Math.min(snapped, seg.wall.longitud - moduleAncho))
      if (!overlaps(placements, seg.wall.id, clamped, moduleAncho, planDrag.placementId)) {
        onPlanDragEnd(planDrag.placementId, clamped)
      }
    }
    setPlanDrag(null)
  }

  // Build cabinet rects for rendering
  type CabRect = {
    x: number; y: number; w: number; h: number
    nivel: string; isAppliance: boolean
    placement: Placement; isDragging: boolean; isSelected: boolean
    segIdx: number
  }
  const cabinetRects: CabRect[] = []
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]
    const wallPlacements = placements.filter((p) => p.wallId === seg.wall.id)
    for (const p of wallPlacements) {
      const isAppliance = p.modulo.tipoModulo === 'Electrodoméstico'
      const depth = (p.nivel === 'alto' ? profBase * 0.6 : profBase) * scale
      const isDragging = planDrag?.placementId === p.id
      const currentPos = isDragging && planDrag ? planDrag.currentPosicion : p.posicion
      const moduleW = (p.modulo.ancho || 300) * scale

      let x: number, y: number, w: number, h: number
      if (seg.cabinetDir === 'down') {
        x = seg.x1 + currentPos * scale; y = seg.y1; w = moduleW; h = depth
      } else if (seg.cabinetDir === 'up') {
        x = seg.x1 + currentPos * scale; y = seg.y1 - depth; w = moduleW; h = depth
      } else if (seg.cabinetDir === 'right') {
        x = seg.x1; y = seg.y1 + currentPos * scale; w = depth; h = moduleW
      } else {
        x = seg.x1 - depth; y = seg.y1 + currentPos * scale; w = depth; h = moduleW
      }

      cabinetRects.push({
        x, y, w, h, nivel: p.nivel, isAppliance,
        placement: p, isDragging, isSelected: p.id === selectedPlacementId, segIdx: si,
      })
    }
  }

  return (
    <div className="overflow-auto">
      <svg
        width={PLAN_W} height={PLAN_H}
        className={cn('block bg-slate-900 rounded-lg select-none', planDrag ? 'cursor-grabbing' : placingModule ? 'cursor-crosshair' : 'cursor-default')}
        onMouseMove={handleSvgMouseMove}
        onClick={handleSvgClick}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={() => {
          if (planDrag) { onPlanDragEnd(planDrag.placementId, planDrag.startPosicion); setPlanDrag(null) }
          setHoverSeg(null)
        }}
      >
        {/* Cabinet rects (below walls) */}
        {cabinetRects.map((r, i) => {
          if (r.isAppliance) {
            return (
              <g key={i} onClick={(e) => { e.stopPropagation(); onPlacementClick(r.placement) }} className="cursor-pointer">
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#374151" fillOpacity={0.9} stroke={r.isSelected ? '#fff' : '#6b7280'} strokeWidth={r.isSelected ? 2 : 1.5} strokeDasharray="4,2" rx={2} />
                <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#9ca3af" fontFamily="sans-serif">⚡</text>
              </g>
            )
          }
          const colors = NIVEL_COLORS[r.nivel] ?? NIVEL_COLORS.base
          return (
            <g
              key={i}
              onClick={(e) => { e.stopPropagation(); onPlacementClick(r.placement) }}
              onMouseDown={(e) => {
                if (placingModule) return
                e.stopPropagation()
                const seg = segments[r.segIdx]
                const svgRect = e.currentTarget.closest('svg')!.getBoundingClientRect()
                const posMm = getPosOnSeg(seg, e.clientX, e.clientY, svgRect)
                const offset = posMm - r.placement.posicion
                setPlanDrag({
                  placementId: r.placement.id, segIdx: r.segIdx,
                  startClientX: e.clientX, startClientY: e.clientY,
                  startPosicion: r.placement.posicion, currentPosicion: r.placement.posicion,
                })
              }}
              className="cursor-grab"
            >
              <rect
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill={colors.fill} fillOpacity={0.65}
                stroke={r.isDragging ? '#f59e0b' : r.isSelected ? '#ffffff' : colors.stroke}
                strokeWidth={r.isDragging || r.isSelected ? 2 : 1}
                rx={1}
              />
            </g>
          )
        })}

        {/* Ghost preview in plan view */}
        {placingModule && hoverSeg !== null && (() => {
          const seg = segments[hoverSeg.idx]
          const posMm = Math.min(hoverSeg.posMm, seg.wall.longitud - (placingModule.ancho || 300))
          const depth = profBase * scale
          const moduleW = (placingModule.ancho || 300) * scale
          const hasOv = overlaps(placements, seg.wall.id, posMm, placingModule.ancho || 300)
          const color = hasOv ? '#ef4444' : '#3b82f6'
          let gx: number, gy: number, gw: number, gh: number
          if (seg.cabinetDir === 'down') { gx = seg.x1 + posMm * scale; gy = seg.y1; gw = moduleW; gh = depth }
          else if (seg.cabinetDir === 'up') { gx = seg.x1 + posMm * scale; gy = seg.y1 - depth; gw = moduleW; gh = depth }
          else if (seg.cabinetDir === 'right') { gx = seg.x1; gy = seg.y1 + posMm * scale; gw = depth; gh = moduleW }
          else { gx = seg.x1 - depth; gy = seg.y1 + posMm * scale; gw = depth; gh = moduleW }
          return (
            <g pointerEvents="none">
              <rect x={gx} y={gy} width={gw} height={gh} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} strokeDasharray="5,3" rx={2} />
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
              <line
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={isActive ? '#3b82f6' : '#64748b'}
                strokeWidth={isActive ? wallThick + 2 : wallThick}
                strokeLinecap="square"
              />
              <text
                x={labelX} y={labelY}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill={isActive ? '#93c5fd' : '#94a3b8'}
                fontFamily="sans-serif"
              >
                {s.wall.nombre}
                {' '}
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
          <g transform="translate(216, 0)">
            <rect x={0} y={0} width={10} height={10} fill="#374151" stroke="#6b7280" strokeWidth={1} strokeDasharray="3,2" />
            <text x={13} y={8} fontSize={9} fill="#94a3b8" fontFamily="sans-serif">electrodoméstico</text>
          </g>
          <g transform="translate(320, 0)">
            <text x={0} y={8} fontSize={9} fill="#475569" fontFamily="sans-serif">Clic en pared para seleccionar</text>
          </g>
        </g>
      </svg>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KitchenConfiguratorClient({ project, availableModules }: Props) {
  const router = useRouter()

  const [placements, setPlacements] = useState<Placement[]>(
    project.placements.map((p) => ({ ...p, alturaDesdeSupelo: (p as { alturaDesdeSupelo?: number }).alturaDesdeSupelo ?? DEFAULT_ALTURA_DESDE_SUELO }))
  )
  const [activeWallId, setActiveWallId] = useState<number>(project.paredes[0]?.id ?? 0)
  const [view, setView] = useState<'elevation' | 'plan'>('elevation')
  const [placingModule, setPlacingModule] = useState<ModuloBasic | null>(null)
  const [selectedPlacement, setSelectedPlacement] = useState<Placement | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState('Todos')
  const [calcResults, setCalcResults] = useState<CalcResult[] | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [positionInput, setPositionInput] = useState('')
  const [alturaInput, setAlturaInput] = useState(String(DEFAULT_ALTURA_DESDE_SUELO))
  const [showPresupuestoModal, setShowPresupuestoModal] = useState(false)
  const [presupuestoNombre, setPresupuestoNombre] = useState(project.nombre)
  const [generatingPresupuesto, setGeneratingPresupuesto] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 4000)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeWall = project.paredes.find((w) => w.id === activeWallId) ?? project.paredes[0]
  const wallPlacements = placements.filter((p) => p.wallId === activeWallId)
  const adjacentWalls = getAdjacentWalls(project.paredes, activeWallId, project.layoutType)

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

  const totalCalcCost = calcResults?.reduce((s, r) => s + r.costoEstimado, 0) ?? 0

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleModuleSelect(m: ModuloBasic) {
    setPlacingModule(placingModule?.id === m.id ? null : m)
    setSelectedPlacement(null)
  }

  async function handleCanvasClick(xMm: number) {
    if (!placingModule || !activeWall) return
    const moduleAncho = placingModule.ancho || 0
    const snapped = Math.round(xMm / SNAP_MM) * SNAP_MM
    const clampedPos = Math.max(0, Math.min(snapped, activeWall.longitud - moduleAncho))
    if (moduleAncho > 0 && clampedPos + moduleAncho > activeWall.longitud) {
      showError('El módulo no cabe en esta posición de la pared.')
      return
    }
    if (overlaps(placements, activeWallId, clampedPos, moduleAncho || 1)) {
      showError('Hay un módulo en esa posición.')
      return
    }
    await doPlace(activeWallId, clampedPos)
  }

  async function handlePlanPlace(wallId: number, positionMm: number) {
    if (!placingModule) return
    const wall = project.paredes.find((w) => w.id === wallId)
    if (!wall) return
    const moduleAncho = placingModule.ancho || 0
    const clamped = Math.max(0, Math.min(positionMm, wall.longitud - moduleAncho))
    if (overlaps(placements, wallId, clamped, moduleAncho || 1)) {
      showError('Hay un módulo en esa posición.')
      return
    }
    // Switch to that wall in elevation view too
    setActiveWallId(wallId)
    await doPlace(wallId, clamped)
  }

  async function doPlace(wallId: number, posicion: number) {
    if (!placingModule) return
    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallId,
          moduloId: placingModule.id,
          posicion,
          nivel: 'base',
          alturaDesdeSupelo: DEFAULT_ALTURA_DESDE_SUELO,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showError((err as { error?: string }).error ?? 'Error al colocar el módulo.')
        return
      }
      const newPlacement = await res.json() as Placement
      setPlacements((prev) => [...prev, { ...newPlacement, alturaDesdeSupelo: newPlacement.alturaDesdeSupelo ?? DEFAULT_ALTURA_DESDE_SUELO }])
      setCalcResults(null)
    } catch (err) {
      console.error(err)
      showError('Error de conexión al guardar.')
    }
  }

  function handlePlacementClick(p: Placement) {
    if (placingModule) return
    setSelectedPlacement(p)
    setPositionInput(String(Math.round(p.posicion)))
    setAlturaInput(String(Math.round(p.alturaDesdeSupelo ?? DEFAULT_ALTURA_DESDE_SUELO)))
    // Switch elevation tab to the wall containing this placement
    setActiveWallId(p.wallId)
  }

  async function handleDeletePlacement(pid: number) {
    try {
      await fetch(`/api/cocinas/${project.id}/placements/${pid}`, { method: 'DELETE' })
      setPlacements(placements.filter((p) => p.id !== pid))
      if (selectedPlacement?.id === pid) setSelectedPlacement(null)
      setCalcResults(null)
    } catch (err) {
      console.error(err)
    }
  }

  function handlePositionChange(val: string) {
    setPositionInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!selectedPlacement || !activeWall) return
      const newPos = parseFloat(val)
      if (isNaN(newPos)) return
      const clampedPos = Math.max(0, Math.min(newPos, activeWall.longitud - selectedPlacement.modulo.ancho))
      if (overlaps(placements, selectedPlacement.wallId, clampedPos, selectedPlacement.modulo.ancho, selectedPlacement.id)) return
      await doPatchPlacement(selectedPlacement.id, { posicion: clampedPos })
    }, 600)
  }

  function handleAlturaChange(val: string) {
    setAlturaInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!selectedPlacement) return
      const newAltura = parseFloat(val)
      if (isNaN(newAltura) || newAltura < 0) return
      await doPatchPlacement(selectedPlacement.id, { alturaDesdeSupelo: newAltura })
    }, 600)
  }

  async function handleNivelChange(nivel: string) {
    if (!selectedPlacement) return
    await doPatchPlacement(selectedPlacement.id, { nivel })
  }

  async function doPatchPlacement(id: number, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return
      const updated = await res.json() as Placement
      const merged = { ...updated, alturaDesdeSupelo: updated.alturaDesdeSupelo ?? DEFAULT_ALTURA_DESDE_SUELO }
      setPlacements((prev) => prev.map((p) => (p.id === id ? merged : p)))
      if (selectedPlacement?.id === id) setSelectedPlacement(merged)
      setCalcResults(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Drag end from elevation view (may jump to adjacent wall)
  async function handleElevDragEnd(placementId: number, newPosicion: number, targetWall?: Wall) {
    const p = placements.find((x) => x.id === placementId)
    if (!p) return
    const data: Record<string, unknown> = { posicion: newPosicion }
    if (targetWall && targetWall.id !== p.wallId) {
      data.wallId = targetWall.id
      setActiveWallId(targetWall.id)
    }
    await doPatchPlacement(placementId, data)
  }

  // Drag end from plan view
  async function handlePlanDragEnd(placementId: number, newPosicion: number) {
    await doPatchPlacement(placementId, { posicion: newPosicion })
  }

  const handleCalcular = useCallback(async () => {
    setCalculating(true)
    try {
      const res = await fetch(`/api/cocinas/${project.id}/calcular`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json() as CalcResult[]
      setCalcResults(data)
      setSelectedPlacement(null)
    } finally {
      setCalculating(false)
    }
  }, [project.id])

  async function handleGenerarPresupuesto() {
    setGeneratingPresupuesto(true)
    try {
      const res = await fetch(`/api/cocinas/${project.id}/presupuesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: presupuestoNombre }),
      })
      if (!res.ok) return
      const data = await res.json() as { presupuestoId: number }
      router.push(`/presupuestos/${data.presupuestoId}`)
    } finally {
      setGeneratingPresupuesto(false)
      setShowPresupuestoModal(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setPlacingModule(null); setHoverX(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-screen bg-[#0b0f1a]"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-slate-900 flex-shrink-0">
        <Link href="/cocinas" className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-sm truncate">{project.nombre}</h1>
          <p className="text-slate-500 text-xs">{placements.length} módulo{placements.length !== 1 ? 's' : ''} colocado{placements.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('elevation')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', view === 'elevation' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" />
            Elevación
          </button>
          <button
            onClick={() => setView('plan')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', view === 'plan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}
          >
            <Map className="w-3.5 h-3.5" />
            Planta
          </button>
        </div>
        <button
          onClick={handleCalcular}
          disabled={calculating || placements.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Calculator className="w-3.5 h-3.5" />
          {calculating ? 'Calculando...' : 'Calcular'}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: module library */}
        <aside className="w-60 flex-shrink-0 border-r border-white/5 flex flex-col bg-slate-900/50">
          <div className="p-3 space-y-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar módulos..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(TIPO_FILTER_MAP).map((f) => (
                <button
                  key={f}
                  onClick={() => setTipoFilter(f)}
                  className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors', tipoFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {placingModule && (
            <div className="px-3 py-2 bg-blue-900/30 border-b border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
              <span>ESC para cancelar</span>
              <button onClick={() => setPlacingModule(null)}><X className="w-3 h-3" /></button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredModules.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-8">Sin módulos</p>
            ) : (
              filteredModules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModuleSelect(m)}
                  className={cn(
                    'w-full text-left p-2.5 rounded-lg border transition-colors',
                    placingModule?.id === m.id
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{m.nombre}</p>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{m.tipoModulo}</p>
                      {m.ancho > 0 && m.alto > 0 ? (
                        <p className="text-slate-600 text-xs">{Math.round(m.ancho)}×{Math.round(m.alto)}×{Math.round(m.profundidad)} mm</p>
                      ) : (
                        <p className="text-amber-500 text-xs">⚠ Sin dimensiones</p>
                      )}
                    </div>
                    {m.colorAcabado && (
                      <div className="w-4 h-4 rounded border border-slate-600 flex-shrink-0 mt-0.5" style={{ background: m.colorAcabado }} title={m.colorAcabado} />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {view === 'elevation' ? (
            <>
              {/* Wall tabs */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-white/5 flex-shrink-0">
                {project.paredes.map((wall) => (
                  <button
                    key={wall.id}
                    onClick={() => setActiveWallId(wall.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors border-t border-l border-r',
                      activeWallId === wall.id
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300',
                    )}
                  >
                    Pared {wall.nombre}
                    <span className="ml-1.5 text-slate-600">{Math.round(wall.longitud)}mm</span>
                  </button>
                ))}
              </div>

              {placingModule && (
                <div className="px-4 py-2 bg-blue-900/20 border-b border-blue-500/10 text-xs text-blue-300 flex items-center gap-2 flex-shrink-0">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse inline-block" />
                  Clic en la pared para colocar <strong>{placingModule.nombre}</strong>
                  {' '}({Math.round(placingModule.ancho)}mm) — grilla cada {SNAP_MM}mm
                </div>
              )}

              <div className="flex-1 overflow-auto p-4">
                {errorMsg && (
                  <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}
                {activeWall ? (
                  <ElevationSVG
                    wall={activeWall}
                    placements={wallPlacements}
                    allPlacements={placements}
                    alturaMm={project.alturaMm}
                    selectedPlacementId={selectedPlacement?.id ?? null}
                    placingModule={placingModule}
                    hoverX={hoverX}
                    adjacentAtStart={adjacentWalls.atStart}
                    adjacentAtEnd={adjacentWalls.atEnd}
                    onCanvasClick={handleCanvasClick}
                    onCanvasMouseMove={setHoverX}
                    onCanvasMouseLeave={() => setHoverX(null)}
                    onPlacementClick={handlePlacementClick}
                    onDragEnd={handleElevDragEnd}
                  />
                ) : (
                  <p className="text-slate-600 text-sm">Sin paredes configuradas</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              {errorMsg && (
                <div className="mb-3 px-3 py-2 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                  {errorMsg}
                </div>
              )}
              {placingModule && (
                <div className="mb-3 px-3 py-2 bg-blue-900/20 border border-blue-500/10 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse inline-block" />
                  Haz clic sobre una pared en el plano para colocar <strong>{placingModule.nombre}</strong>
                </div>
              )}
              <InteractivePlanSVG
                walls={project.paredes}
                placements={placements}
                layoutType={project.layoutType}
                profBase={project.profBase}
                activeWallId={activeWallId}
                onWallClick={(wallId) => { setActiveWallId(wallId) }}
                placingModule={placingModule}
                selectedPlacementId={selectedPlacement?.id ?? null}
                onPlanPlace={handlePlanPlace}
                onPlacementClick={handlePlacementClick}
                onPlanDragEnd={handlePlanDragEnd}
              />
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-72 flex-shrink-0 border-l border-white/5 flex flex-col bg-slate-900/50">
          {selectedPlacement ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Módulo seleccionado</h3>
                <button onClick={() => setSelectedPlacement(null)} className="text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-white text-sm font-medium">{selectedPlacement.modulo.nombre}</p>
                <p className="text-slate-400 text-xs">{selectedPlacement.modulo.tipoModulo}</p>
                <p className="text-slate-500 text-xs">
                  {Math.round(selectedPlacement.modulo.ancho)}×{Math.round(selectedPlacement.modulo.alto)}×{Math.round(selectedPlacement.modulo.profundidad)} mm
                </p>
              </div>

              <div>
                <p className="text-slate-400 text-xs font-medium mb-1">Pared</p>
                <p className="text-white text-sm">
                  {project.paredes.find((w) => w.id === selectedPlacement.wallId)?.nombre ?? '-'}
                </p>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1">Posición (mm)</label>
                <input
                  type="number"
                  value={positionInput}
                  onChange={(e) => handlePositionChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <p className="text-slate-400 text-xs font-medium mb-1">Nivel</p>
                <div className="flex gap-1">
                  {(['base', 'alto', 'torre'] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => handleNivelChange(n)}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                        selectedPlacement.nivel === n
                          ? NIVEL_COLORS[n].badge
                          : 'bg-slate-700 text-slate-400 hover:text-white',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPlacement.nivel === 'alto' && (
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1">
                    Altura desde el suelo (mm)
                  </label>
                  <input
                    type="number"
                    value={alturaInput}
                    onChange={(e) => handleAlturaChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
                    placeholder="1400"
                  />
                  <p className="text-slate-600 text-xs mt-1">
                    Parte inferior del módulo aéreo (default 1400mm)
                  </p>
                </div>
              )}

              <button
                onClick={() => handleDeletePlacement(selectedPlacement.id)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar módulo
              </button>
            </div>
          ) : calcResults ? (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  Resultados de cálculo
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {calcResults.length === 0 ? (
                  <p className="text-slate-500 text-xs">Sin piezas para calcular. Agrega módulos con piezas definidas.</p>
                ) : (
                  calcResults.map((r, i) => (
                    <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
                      <p className="text-white text-xs font-semibold truncate">{r.tablero}</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        <span className="text-slate-500 text-xs">Planchas</span>
                        <span className="text-white text-xs font-medium">{r.numPlanchas}</span>
                        <span className="text-slate-500 text-xs">Aprovech.</span>
                        <span className={cn('text-xs font-medium', r.aprovechamiento >= 70 ? 'text-emerald-400' : r.aprovechamiento >= 50 ? 'text-amber-400' : 'text-red-400')}>
                          {r.aprovechamiento.toFixed(1)}%
                        </span>
                        <span className="text-slate-500 text-xs">Costo</span>
                        <span className="text-emerald-400 text-xs font-medium">{formatCurrency(r.costoEstimado)}</span>
                      </div>
                    </div>
                  ))
                )}
                {calcResults.length > 0 && (
                  <div className="border-t border-white/5 pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-sm font-medium">Total materiales</span>
                      <span className="text-emerald-400 text-sm font-bold">{formatCurrency(totalCalcCost)}</span>
                    </div>
                  </div>
                )}
              </div>
              {calcResults.length > 0 && (
                <div className="p-4 border-t border-white/5">
                  <button
                    onClick={() => setShowPresupuestoModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Generar Presupuesto
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <LayoutPanelLeft className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm font-medium">Panel de propiedades</p>
              <p className="text-slate-600 text-xs mt-1">
                Selecciona un módulo y haz clic en la pared para colocarlo.
                Luego haz clic en un módulo colocado para editar sus propiedades.
              </p>
              {placements.length > 0 && (
                <button
                  onClick={handleCalcular}
                  disabled={calculating}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/20 rounded-lg text-sm transition-colors"
                >
                  <Calculator className="w-4 h-4" />
                  {calculating ? 'Calculando...' : 'Calcular materiales'}
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Presupuesto modal */}
      {showPresupuestoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Generar Presupuesto</h3>
              <button onClick={() => setShowPresupuestoModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Nombre del presupuesto</label>
              <input
                type="text"
                value={presupuestoNombre}
                onChange={(e) => setPresupuestoNombre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total estimado</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(totalCalcCost)}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPresupuestoModal(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerarPresupuesto}
                disabled={generatingPresupuesto}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {generatingPresupuesto ? 'Generando...' : 'Crear presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
