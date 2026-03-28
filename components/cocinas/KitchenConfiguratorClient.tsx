'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calculator, LayoutPanelLeft, Map, Search, X,
  ChevronRight, Trash2, FileText,
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
const WALL_CABINET_BASE_MM = 900

const TIPO_FILTER_MAP: Record<string, string[]> = {
  Todos: [],
  Base: ['Base con puertas', 'Base con cajones', 'Base mixto'],
  Aéreo: ['Aéreo con puertas'],
  Torre: ['Columna', 'Torre'],
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

// ── Elevation SVG ─────────────────────────────────────────────────────────────

function ElevationSVG({
  wall,
  placements,
  alturaMm,
  selectedPlacementId,
  placingModule,
  hoverX,
  onCanvasClick,
  onCanvasMouseMove,
  onCanvasMouseLeave,
  onPlacementClick,
}: {
  wall: Wall
  placements: Placement[]
  alturaMm: number
  selectedPlacementId: number | null
  placingModule: ModuloBasic | null
  hoverX: number | null
  onCanvasClick: (xMm: number) => void
  onCanvasMouseMove: (xMm: number) => void
  onCanvasMouseLeave: () => void
  onPlacementClick: (placement: Placement) => void
}) {
  const scale = CANVAS_HEIGHT_PX / alturaMm
  const svgWidth = Math.max(wall.longitud * scale, 400)

  const yFloor = CANVAS_HEIGHT_PX
  const yCountertop = yFloor - COUNTERTOP_MM * scale
  const yWallCabBase = yFloor - WALL_CABINET_BASE_MM * scale

  // Ruler ticks every 500mm
  const rulerTicks: number[] = []
  for (let mm = 0; mm <= wall.longitud; mm += 500) rulerTicks.push(mm)

  // Grid lines every 600mm
  const gridLines: number[] = []
  for (let mm = 0; mm <= wall.longitud; mm += 600) gridLines.push(mm)

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const xMm = xPx / scale
    onCanvasClick(xMm)
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const xMm = xPx / scale
    onCanvasMouseMove(xMm)
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={CANVAS_HEIGHT_PX + 24}
        className={cn('block', placingModule ? 'cursor-crosshair' : 'cursor-default')}
        onClick={handleSvgClick}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={onCanvasMouseLeave}
      >
        {/* Background */}
        <rect x={0} y={0} width={svgWidth} height={CANVAS_HEIGHT_PX + 24} fill="#0f172a" />

        {/* Grid lines */}
        {gridLines.map((mm) => (
          <line
            key={`grid-${mm}`}
            x1={mm * scale} y1={0}
            x2={mm * scale} y2={CANVAS_HEIGHT_PX}
            stroke="#1e293b" strokeWidth={1}
          />
        ))}

        {/* Countertop dashed line */}
        <line
          x1={0} y1={yCountertop}
          x2={svgWidth} y2={yCountertop}
          stroke="#64748b" strokeWidth={1}
          strokeDasharray="6,4"
        />
        <text x={4} y={yCountertop - 3} fill="#64748b" fontSize={9}>Muestrario 850mm</text>

        {/* Wall cabinet base dashed line */}
        <line
          x1={0} y1={yWallCabBase}
          x2={svgWidth} y2={yWallCabBase}
          stroke="#475569" strokeWidth={1}
          strokeDasharray="4,3"
        />
        <text x={4} y={yWallCabBase - 3} fill="#475569" fontSize={9}>Aéreos 900mm</text>

        {/* Floor */}
        <line
          x1={0} y1={yFloor}
          x2={svgWidth} y2={yFloor}
          stroke="#475569" strokeWidth={2}
        />

        {/* Placement modules */}
        {placements.map((p) => {
          const colors = NIVEL_COLORS[p.nivel] ?? NIVEL_COLORS.base
          let rectY: number
          let rectH: number

          if (p.nivel === 'base') {
            rectH = p.modulo.alto * scale
            rectY = yFloor - rectH
          } else if (p.nivel === 'alto') {
            rectY = yWallCabBase - p.modulo.alto * scale
            rectH = p.modulo.alto * scale
          } else {
            // torre
            rectH = p.modulo.alto * scale
            rectY = yFloor - rectH
          }

          const rectX = p.posicion * scale
          const rectW = p.modulo.ancho * scale
          const isSelected = p.id === selectedPlacementId

          return (
            <g
              key={p.id}
              onClick={(e) => { e.stopPropagation(); onPlacementClick(p) }}
              className="cursor-pointer"
            >
              <rect
                x={rectX} y={rectY}
                width={rectW} height={rectH}
                fill={colors.fill}
                fillOpacity={0.7}
                stroke={isSelected ? '#ffffff' : colors.stroke}
                strokeWidth={isSelected ? 2 : 1}
                rx={2}
              />
              {rectW > 24 && rectH > 16 && (
                <text
                  x={rectX + rectW / 2}
                  y={rectY + rectH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(10, rectW / 7, rectH / 2.5)}
                  fill="#ffffff"
                  fontFamily="sans-serif"
                >
                  {rectW > 60 ? p.modulo.nombre.slice(0, 14) : p.modulo.nombre.slice(0, 4)}
                </text>
              )}
              {rectW > 30 && rectH > 28 && (
                <text
                  x={rectX + rectW / 2}
                  y={rectY + rectH / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill="#cbd5e1"
                  fontFamily="sans-serif"
                >
                  {Math.round(p.modulo.ancho)}×{Math.round(p.modulo.alto)}
                </text>
              )}
            </g>
          )
        })}

        {/* Ghost / hover preview */}
        {placingModule && hoverX !== null && (() => {
          const snapped = Math.round(hoverX / SNAP_MM) * SNAP_MM
          const hasOverlap = overlaps(placements, placements[0]?.wallId ?? 0, snapped, placingModule.ancho)
          const rectW = placingModule.ancho * scale
          const rectH = placingModule.alto * scale
          const rectX = snapped * scale
          const rectY = yFloor - rectH
          return (
            <rect
              x={rectX} y={rectY}
              width={rectW} height={rectH}
              fill={hasOverlap ? '#ef4444' : '#3b82f6'}
              fillOpacity={0.3}
              stroke={hasOverlap ? '#ef4444' : '#93c5fd'}
              strokeWidth={1.5}
              strokeDasharray="4,2"
              rx={2}
            />
          )
        })()}

        {/* Ruler */}
        <rect x={0} y={CANVAS_HEIGHT_PX} width={svgWidth} height={24} fill="#1e293b" />
        {rulerTicks.map((mm) => (
          <g key={`ruler-${mm}`}>
            <line
              x1={mm * scale} y1={CANVAS_HEIGHT_PX}
              x2={mm * scale} y2={CANVAS_HEIGHT_PX + (mm % 1000 === 0 ? 8 : 5)}
              stroke="#475569" strokeWidth={1}
            />
            {mm % 500 === 0 && (
              <text
                x={mm * scale} y={CANVAS_HEIGHT_PX + 18}
                textAnchor="middle"
                fontSize={8}
                fill="#64748b"
                fontFamily="monospace"
              >
                {mm}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Plan SVG ──────────────────────────────────────────────────────────────────

function PlanSVG({
  walls,
  placements,
  layoutType,
  profBase,
}: {
  walls: Wall[]
  placements: Placement[]
  layoutType: string
  profBase: number
}) {
  const PLAN_W = 500
  const PLAN_H = 320

  if (walls.length === 0) return (
    <div className="flex items-center justify-center h-[340px] bg-slate-900 rounded-lg text-slate-600 text-sm">
      Sin paredes configuradas
    </div>
  )

  // Simple floor plan based on layoutType
  // We'll draw the walls as lines/rectangles in a top-down view
  const maxLen = Math.max(...walls.map((w) => w.longitud))
  const scale = Math.min(PLAN_W * 0.8, PLAN_H * 0.8) / (maxLen || 3000)

  // Build wall segments based on layoutType
  type Segment = { x1: number; y1: number; x2: number; y2: number; wall: Wall }
  const segments: Segment[] = []
  const padX = 40, padY = 40

  if (layoutType === 'lineal') {
    // Single horizontal wall
    walls.forEach((wall, i) => {
      const offset = walls.slice(0, i).reduce((acc, w) => acc + w.longitud * scale, 0)
      segments.push({
        x1: padX + offset, y1: padY,
        x2: padX + offset + wall.longitud * scale, y2: padY,
        wall,
      })
    })
  } else if (layoutType === 'L') {
    // Two walls: first horizontal, second vertical
    const w0 = walls[0]
    if (w0) {
      segments.push({ x1: padX, y1: padY, x2: padX + w0.longitud * scale, y2: padY, wall: w0 })
    }
    const w1 = walls[1]
    if (w1) {
      segments.push({ x1: padX, y1: padY, x2: padX, y2: padY + w1.longitud * scale, wall: w1 })
    }
    walls.slice(2).forEach((wall, i) => {
      const offset = walls.slice(0, i + 2).reduce((acc, w) => acc + w.longitud * scale, 0)
      segments.push({
        x1: padX + offset, y1: padY + 20,
        x2: padX + offset + wall.longitud * scale, y2: padY + 20,
        wall,
      })
    })
  } else {
    // U: three walls
    const w0 = walls[0]
    const w1 = walls[1]
    const w2 = walls[2]
    if (w0) segments.push({ x1: padX, y1: padY, x2: padX + w0.longitud * scale, y2: padY, wall: w0 })
    if (w1) segments.push({ x1: padX, y1: padY, x2: padX, y2: padY + w1.longitud * scale, wall: w1 })
    if (w2) segments.push({ x1: padX + (w0?.longitud ?? 0) * scale, y1: padY, x2: padX + (w0?.longitud ?? 0) * scale, y2: padY + w2.longitud * scale, wall: w2 })
    walls.slice(3).forEach((wall, i) => {
      const offset = walls.slice(0, i + 3).reduce((acc, w) => acc + w.longitud * scale, 0)
      segments.push({
        x1: padX + offset, y1: padY + 30,
        x2: padX + offset + wall.longitud * scale, y2: padY + 30,
        wall,
      })
    })
  }

  // Cabinets as depth rectangles along each wall
  const cabinetRects: { x: number; y: number; w: number; h: number; nivel: string }[] = []
  for (const seg of segments) {
    const wallPlacements = placements.filter((p) => p.wallId === seg.wall.id)
    const isHorizontal = Math.abs(seg.y2 - seg.y1) < 5
    for (const p of wallPlacements) {
      const depth = profBase * scale
      if (isHorizontal) {
        const startX = seg.x1 + p.posicion * scale
        cabinetRects.push({ x: startX, y: seg.y1, w: p.modulo.ancho * scale, h: depth, nivel: p.nivel })
      } else {
        const startY = seg.y1 + p.posicion * scale
        cabinetRects.push({ x: seg.x1 - depth, y: startY, w: depth, h: p.modulo.ancho * scale, nivel: p.nivel })
      }
    }
  }

  return (
    <div className="overflow-auto">
      <svg width={PLAN_W} height={PLAN_H} className="block bg-slate-900 rounded-lg">
        {cabinetRects.map((r, i) => {
          const colors = NIVEL_COLORS[r.nivel] ?? NIVEL_COLORS.base
          return (
            <rect
              key={i}
              x={r.x} y={r.y}
              width={r.w} height={r.h}
              fill={colors.fill}
              fillOpacity={0.6}
              stroke={colors.stroke}
              strokeWidth={1}
            />
          )
        })}
        {segments.map((s, i) => (
          <g key={i}>
            <line
              x1={s.x1} y1={s.y1}
              x2={s.x2} y2={s.y2}
              stroke="#475569" strokeWidth={8} strokeLinecap="round"
            />
            <text
              x={(s.x1 + s.x2) / 2}
              y={(s.y1 + s.y2) / 2 - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
              fontFamily="sans-serif"
            >
              Pared {s.wall.nombre}
            </text>
          </g>
        ))}
        {/* Legend */}
        <g>
          {Object.entries(NIVEL_COLORS).map(([nivel, c], i) => (
            <g key={nivel} transform={`translate(${10 + i * 80}, ${PLAN_H - 20})`}>
              <rect x={0} y={0} width={12} height={12} fill={c.fill} fillOpacity={0.7} />
              <text x={16} y={10} fontSize={9} fill="#94a3b8" fontFamily="sans-serif">
                {nivel}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KitchenConfiguratorClient({ project, availableModules }: Props) {
  const router = useRouter()

  const [placements, setPlacements] = useState<Placement[]>(project.placements)
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
  const [showPresupuestoModal, setShowPresupuestoModal] = useState(false)
  const [presupuestoNombre, setPresupuestoNombre] = useState(project.nombre)
  const [generatingPresupuesto, setGeneratingPresupuesto] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeWall = project.paredes.find((w) => w.id === activeWallId) ?? project.paredes[0]

  const wallPlacements = placements.filter((p) => p.wallId === activeWallId)

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
    if (placingModule?.id === m.id) {
      setPlacingModule(null)
    } else {
      setPlacingModule(m)
      setSelectedPlacement(null)
    }
  }

  async function handleCanvasClick(xMm: number) {
    if (!placingModule || !activeWall) return

    const snapped = Math.round(xMm / SNAP_MM) * SNAP_MM
    const clampedPos = Math.max(0, Math.min(snapped, activeWall.longitud - placingModule.ancho))

    if (overlaps(placements, activeWallId, clampedPos, placingModule.ancho)) return

    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallId: activeWallId,
          moduloId: placingModule.id,
          posicion: clampedPos,
          nivel: 'base',
        }),
      })
      if (!res.ok) return
      const newPlacement = await res.json() as Placement
      setPlacements([...placements, newPlacement])
      setCalcResults(null)
    } catch (err) {
      console.error(err)
    }
  }

  function handlePlacementClick(p: Placement) {
    if (placingModule) return
    setSelectedPlacement(p)
    setPositionInput(String(Math.round(p.posicion)))
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
      try {
        const res = await fetch(`/api/cocinas/${project.id}/placements/${selectedPlacement.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posicion: clampedPos }),
        })
        if (!res.ok) return
        const updated = await res.json() as Placement
        setPlacements(placements.map((p) => (p.id === updated.id ? updated : p)))
        setSelectedPlacement(updated)
        setCalcResults(null)
      } catch (err) {
        console.error(err)
      }
    }, 600)
  }

  async function handleNivelChange(nivel: string) {
    if (!selectedPlacement) return
    try {
      const res = await fetch(`/api/cocinas/${project.id}/placements/${selectedPlacement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel }),
      })
      if (!res.ok) return
      const updated = await res.json() as Placement
      setPlacements(placements.map((p) => (p.id === updated.id ? updated : p)))
      setSelectedPlacement(updated)
      setCalcResults(null)
    } catch (err) {
      console.error(err)
    }
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

  // ── Keyboard ESC ──────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setPlacingModule(null)
      setHoverX(null)
    }
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
        {/* View toggle */}
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('elevation')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'elevation' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" />
            Elevación
          </button>
          <button
            onClick={() => setView('plan')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              view === 'plan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            )}
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

      {/* Body: left + canvas + right */}
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
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                    tipoFilter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:text-white'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {placingModule && (
            <div className="px-3 py-2 bg-blue-900/30 border-b border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
              <span>ESC para cancelar</span>
              <button onClick={() => setPlacingModule(null)}>
                <X className="w-3 h-3" />
              </button>
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
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{m.nombre}</p>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{m.tipoModulo}</p>
                      <p className="text-slate-600 text-xs">
                        {Math.round(m.ancho)}×{Math.round(m.alto)}×{Math.round(m.profundidad)} mm
                      </p>
                    </div>
                    {m.colorAcabado && (
                      <div
                        className="w-4 h-4 rounded border border-slate-600 flex-shrink-0 mt-0.5"
                        style={{ background: m.colorAcabado }}
                        title={m.colorAcabado}
                      />
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
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                    )}
                  >
                    Pared {wall.nombre}
                    <span className="ml-1.5 text-slate-600">{Math.round(wall.longitud)}mm</span>
                  </button>
                ))}
              </div>

              {/* Instruction bar */}
              {placingModule && (
                <div className="px-4 py-2 bg-blue-900/20 border-b border-blue-500/10 text-xs text-blue-300 flex items-center gap-2 flex-shrink-0">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse inline-block" />
                  Clic en la pared para colocar <strong>{placingModule.nombre}</strong>
                  {' '}({Math.round(placingModule.ancho)}mm) — grilla cada {SNAP_MM}mm
                </div>
              )}

              {/* SVG canvas */}
              <div className="flex-1 overflow-auto p-4">
                {activeWall ? (
                  <ElevationSVG
                    wall={activeWall}
                    placements={wallPlacements}
                    alturaMm={project.alturaMm}
                    selectedPlacementId={selectedPlacement?.id ?? null}
                    placingModule={placingModule}
                    hoverX={hoverX}
                    onCanvasClick={handleCanvasClick}
                    onCanvasMouseMove={setHoverX}
                    onCanvasMouseLeave={() => setHoverX(null)}
                    onPlacementClick={handlePlacementClick}
                  />
                ) : (
                  <p className="text-slate-600 text-sm">Sin paredes configuradas</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <PlanSVG
                walls={project.paredes}
                placements={placements}
                layoutType={project.layoutType}
                profBase={project.profBase}
              />
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-72 flex-shrink-0 border-l border-white/5 flex flex-col bg-slate-900/50">
          {selectedPlacement ? (
            // Placement properties
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Módulo seleccionado</h3>
                <button
                  onClick={() => setSelectedPlacement(null)}
                  className="text-slate-500 hover:text-white"
                >
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
                          : 'bg-slate-700 text-slate-400 hover:text-white'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleDeletePlacement(selectedPlacement.id)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar módulo
              </button>
            </div>
          ) : calcResults ? (
            // Calculation results
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
                        <span className={cn(
                          'text-xs font-medium',
                          r.aprovechamiento >= 70 ? 'text-emerald-400' : r.aprovechamiento >= 50 ? 'text-amber-400' : 'text-red-400'
                        )}>
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
            // Default state
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <LayoutPanelLeft className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm font-medium">Panel de propiedades</p>
              <p className="text-slate-600 text-xs mt-1">
                Selecciona un módulo de la biblioteca y haz clic en la pared para colocarlo.
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
