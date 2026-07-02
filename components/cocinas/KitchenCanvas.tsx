'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  type ModuloBasic, type Placement, type Wall, NIVEL_COLORS, SNAP_MM, CANVAS_HEIGHT_PX, COUNTERTOP_MM, DEFAULT_ALTURA, overlaps, nivelGroup, nivelForTipo, computeSegments,
} from './kitchen-plan'

// ── Elevation SVG ─────────────────────────────────────────────────────────────

export function ElevationSVG({
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

export function InteractivePlanSVG({
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

