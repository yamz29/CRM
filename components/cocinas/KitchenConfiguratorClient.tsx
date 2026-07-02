'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Calculator, LayoutPanelLeft, Map, Search, X,
  Trash2, FileText, Layers, ClipboardList, Copy, Check, Grid2x2,
} from 'lucide-react'
import { useSmartBack } from '@/components/ui/back-button'
import { cn, formatCurrency } from '@/lib/utils'
import {
  type ModuloBasic, type Placement, type Wall, type CalcResult, type Props,
  NIVEL_COLORS, SNAP_MM, DEFAULT_ALTURA, TIPO_FILTER_MAP,
  overlaps, nivelGroup, nivelForTipo, getAdjacentWalls, } from './kitchen-plan'
import { ElevationSVG, InteractivePlanSVG } from './KitchenCanvas'
import { KitchenNestingModal as NestingModal } from './KitchenNestingModal'

// ── Main Component ─────────────────────────────────────────────────────────────

export function KitchenConfiguratorClient({ project, availableModules }: Props) {
  const router = useRouter()
  const goBack = useSmartBack('/cocinas')

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
        <button type="button" onClick={goBack} aria-label="Volver" className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-foreground font-semibold text-sm truncate">{project.nombre}</h1>
          <p className="text-muted-foreground text-xs">{placements.length} módulo{placements.length !== 1 ? 's' : ''} colocado{placements.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          <button onClick={() => setView('elevation')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', view === 'elevation' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutPanelLeft className="w-3.5 h-3.5" />Elevación
          </button>
          <button onClick={() => setView('plan')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', view === 'plan' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
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
                  className={cn('px-2 py-0.5 rounded-full text-xs font-medium transition-colors', tipoFilter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
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
                            isWallActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground/70 hover:bg-muted/80')}
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
                      className="px-1.5 py-1 text-2xs text-muted-foreground hover:text-foreground font-mono min-w-[36px]"
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
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors">
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
                className="flex-1 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {generatingApu ? 'Creando...' : 'Crear APU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
