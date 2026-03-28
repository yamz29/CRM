// ── Shared Nesting Library ────────────────────────────────────────────────────
// Shelf-packing (NFDH) algorithm shared between melamina module and kitchen configurator

export const NEST_COLORS = [
  '#bfdbfe','#bbf7d0','#fef08a','#fed7aa','#e9d5ff',
  '#fbcfe8','#bae6fd','#a7f3d0','#fde68a','#ddd6fe',
  '#99f6e4','#fecaca','#d9f99d','#e0e7ff','#fef3c7',
]

export interface NestPieceIn {
  key: string
  etiqueta: string
  nombre: string
  w: number
  h: number
  material?: string
}

export interface PlacedPiece extends NestPieceIn {
  x: number
  y: number
  rotada: boolean
  colorIdx: number
}

export interface NestSheet {
  id: number
  piezas: PlacedPiece[]
}

export interface NestGroup {
  tablero: string
  boardW: number
  boardH: number
  sheets: NestSheet[]
  totalPiezaAreaMm2: number
  totalSheetAreaMm2: number
  aprovechamiento: number
}

/**
 * Run NFDH shelf-packing nesting on a flat list of pieces.
 *
 * @param piezas          Flat list of individual pieces (already expanded by quantity)
 * @param materialLookup  Map of material name → { boardW, boardH, precio }
 * @param defaultBoardW   Board width to use when material not found in lookup
 * @param defaultBoardH   Board height to use when material not found in lookup
 * @param kerf            Saw kerf in mm (default 4)
 * @param allowRotation   Whether pieces can be rotated 90° (default true)
 */
export function runNesting(
  piezas: NestPieceIn[],
  materialLookup: Record<string, { boardW: number; boardH: number; precio: number }>,
  defaultBoardW: number,
  defaultBoardH: number,
  kerf = 4,
  allowRotation = true,
): NestGroup[] {
  // 1. Group pieces by material
  const groups: Record<string, NestPieceIn[]> = {}
  for (const p of piezas) {
    const key = p.material || 'Sin tablero'
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }

  return Object.entries(groups).map(([tablero, pieces]) => {
    const lookup = materialLookup[tablero]
    const boardW = lookup?.boardW ?? defaultBoardW
    const boardH = lookup?.boardH ?? defaultBoardH

    // 2. Orient pieces (landscape when rotation allowed) and sort by height desc
    const oriented = pieces.map((p) => {
      if (allowRotation && p.h > p.w) return { ...p, w: p.h, h: p.w, rotada: true }
      return { ...p, rotada: false }
    }).sort((a, b) => b.h - a.h || b.w - a.w)

    // 3. Shelf packing
    const sheets: NestSheet[] = []
    let sheetPiezas: PlacedPiece[] = []
    let shelfY = 0, shelfH = 0, shelfX = 0
    let colorIdx = 0

    const newSheet = () => {
      if (sheetPiezas.length > 0) sheets.push({ id: sheets.length + 1, piezas: sheetPiezas })
      sheetPiezas = []
      shelfY = 0; shelfH = 0; shelfX = 0
    }

    for (const p of oriented) {
      let pw = p.w, ph = p.h
      const rotada = 'rotada' in p ? (p as NestPieceIn & { rotada?: boolean }).rotada ?? false : false

      // Skip pieces too large for any sheet
      if (pw > boardW || ph > boardH) {
        if (allowRotation && p.h <= boardW && p.w <= boardH) { pw = p.h; ph = p.w }
        else continue
      }

      const place = () => {
        sheetPiezas.push({
          ...p,
          w: pw,
          h: ph,
          x: shelfX,
          y: shelfY,
          rotada,
          colorIdx: colorIdx++ % NEST_COLORS.length,
        })
        shelfX += pw + kerf
        if (ph > shelfH) shelfH = ph
      }

      if (shelfX + pw > boardW) {
        // New shelf
        shelfY += shelfH + kerf
        shelfX = 0; shelfH = 0
        if (shelfY + ph > boardH) newSheet()
      }
      if (shelfX + pw > boardW) {
        // Still doesn't fit → skip
        continue
      }
      place()
    }
    if (sheetPiezas.length > 0) sheets.push({ id: sheets.length + 1, piezas: sheetPiezas })

    const totalPiezaAreaMm2 = pieces.reduce((acc, p) => acc + p.w * p.h, 0)
    const totalSheetAreaMm2 = sheets.length * boardW * boardH

    return {
      tablero,
      boardW,
      boardH,
      sheets,
      totalPiezaAreaMm2,
      totalSheetAreaMm2,
      aprovechamiento: totalSheetAreaMm2 > 0 ? (totalPiezaAreaMm2 / totalSheetAreaMm2) * 100 : 0,
    }
  })
}
