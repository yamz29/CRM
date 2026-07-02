'use client'


// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModuloBasic {
  id: number
  nombre: string
  tipoModulo: string
  ancho: number
  alto: number
  profundidad: number
  colorAcabado: string | null
  materialTableroId: number | null
}

export interface Placement {
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

export interface Wall {
  id: number
  nombre: string
  longitud: number
  orden: number
}

export interface KitchenProjectData {
  id: number
  nombre: string
  layoutType: string
  alturaMm: number
  profBase: number
  profAlto: number
  paredes: Wall[]
  placements: Placement[]
}

export interface PiezaCorte {
  etiqueta: string
  nombre: string
  largo: number
  ancho: number
  cantidad: number
  modulo: string
  tapacanto: string[]
}

export interface PlacedPieceVis {
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

export interface NestSheetVis {
  id: number
  piezas: PlacedPieceVis[]
}

export interface CalcResult {
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

export interface Props {
  project: KitchenProjectData
  availableModules: ModuloBasic[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const NIVEL_COLORS: Record<string, { fill: string; stroke: string; badge: string }> = {
  base:  { fill: '#1d4ed8', stroke: '#3b82f6', badge: 'bg-primary text-blue-100' },
  alto:  { fill: '#15803d', stroke: '#22c55e', badge: 'bg-green-700 text-green-100' },
  torre: { fill: '#b45309', stroke: '#f59e0b', badge: 'bg-amber-700 text-amber-100' },
  isla:  { fill: '#6b21a8', stroke: '#a855f7', badge: 'bg-purple-800 text-purple-100' },
}

export const SNAP_MM = 50
export const CANVAS_HEIGHT_PX = 380
export const COUNTERTOP_MM = 850
export const DEFAULT_ALTURA = 1500

export const TIPO_FILTER_MAP: Record<string, string[]> = {
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
export function overlaps(
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

export function nivelGroup(nivel: string): 'floor' | 'wall' {
  return nivel === 'alto' ? 'wall' : 'floor'
}

export const TIPOS_AEREO = ['Aéreo con puertas', 'Aéreo', 'Repisa']

export function nivelForTipo(tipoModulo: string): string {
  return TIPOS_AEREO.some((t) => tipoModulo.includes(t)) ? 'alto' : 'base'
}

export function getAdjacentWalls(
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

export function computeSegments(
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

