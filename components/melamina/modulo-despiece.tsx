'use client'

/**
 * Tipos, constantes y lógica pura del editor de módulos de melamina
 * (extraído de ModuloEditor.tsx en la auditoría F6 — antes convivían 400
 * líneas de cálculo con 1.200 de UI). Sin estado ni efectos: todo acá es
 * función pura + el SVG presentacional de plancha, así que es testeable
 * con Vitest igual que lib/nesting.ts.
 *
 * Nota: `runNesting` de acá es el wrapper de dominio (agrupa PiezaLine por
 * tablero y expande cantidades) sobre el mismo shelf-packing que implementa
 * lib/nesting.ts para el configurador de cocinas. Unificarlos cambiaría
 * defaults (kerf) — pendiente "al tocar" con tests de por medio.
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PiezaLine {
  _key: string
  id?: number
  etiqueta: string
  nombre: string
  tipoPieza: string
  largo: number
  ancho: number
  cantidad: number
  espesor: number
  material: string
  tapacanto: string[]
  tapacantoColor: string
  llevaMecanizado: boolean
  tipoMecanizado: string | null
  observaciones: string
}

export interface MaterialModuloLine {
  _key: string
  id?: number
  materialId: number | null
  tipo: string
  unidad: string
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
  search: string
}

export interface MaterialRef {
  id: number
  tipo: string
  nombre: string
  codigo: string | null
  marca: string | null
  unidad: string
  precio: number
  anchoMm: number | null
  largoMm: number | null
  espesorMm: number | null
}

export interface ModuloData {
  id: number
  proyectoId: number | null
  codigo: string | null
  tipoModulo: string
  nombre: string
  ancho: number
  alto: number
  profundidad: number
  cantidadPuertas: number
  cantidadCajones: number
  material: string
  colorAcabado: string | null
  cantidad: number
  costoMateriales: number
  costoManoObra: number
  costoInstalacion: number
  precioVenta: number
  estadoProduccion: string
  observaciones: string | null
  materialTableroId: number | null
  materialTablero: MaterialRef | null
  anchoPlanchaCm: number
  largoPlanchaCm: number
  piezas: (Omit<PiezaLine, '_key'>)[]
  materialesModulo: (Omit<MaterialModuloLine, '_key' | 'search'> & {
    material?: MaterialRef | null
  })[]
}

export const TIPOS_MODULO_DEFAULT = [
  'Base con puertas', 'Base con cajones', 'Base mixto',
  'Aéreo con puertas', 'Repisa', 'Columna', 'Closet', 'Baño', 'Oficina', 'Otro',
]

export const ESTADOS_PRODUCCION = [
  'Diseño', 'En corte', 'En canteado', 'En armado', 'Instalado', 'Entregado',
]

export const ETIQUETAS_PIEZA = [
  { value: 'Lat', label: 'Lat – Lateral' },
  { value: 'Piso', label: 'Piso' },
  { value: 'Fondo', label: 'Fondo' },
  { value: 'Sop', label: 'Sop – Soporte' },
  { value: 'Techo', label: 'Techo' },
  { value: 'Div', label: 'Div – División' },
  { value: 'Repi', label: 'Repi – Repisa' },
  { value: 'Puerta', label: 'Puerta' },
  { value: 'F-Caj', label: 'F-Caj – Frente cajón' },
  { value: 'T-Caj', label: 'T-Caj – Trasero cajón' },
  { value: 'Fd-Caj', label: 'Fd-Caj – Fondo cajón' },
  { value: 'Otro', label: 'Otro' },
]

export const TAPACANTO_LADOS = [
  { key: 'superior', label: 'S', title: 'Superior' },
  { key: 'inferior', label: 'I', title: 'Inferior' },
  { key: 'izquierdo', label: 'L', title: 'Izquierdo' },
  { key: 'derecho', label: 'R', title: 'Derecho' },
]

let keyCounter = 0
export const newKey = () => `k${++keyCounter}`

// ── Cálculos ──────────────────────────────────────────────────────────────────

export function calcAreaM2(p: PiezaLine) {
  return (p.largo * p.ancho * p.cantidad) / 1_000_000
}

export function calcTapacantoMl(p: PiezaLine) {
  let ml = 0
  if (p.tapacanto.includes('superior')) ml += p.ancho
  if (p.tapacanto.includes('inferior')) ml += p.ancho
  if (p.tapacanto.includes('izquierdo')) ml += p.largo
  if (p.tapacanto.includes('derecho')) ml += p.largo
  return (ml * p.cantidad) / 1000
}

// Agrupa ML de tapacanto por color para el resumen de materiales
export function calcTapacantoByColor(piezas: PiezaLine[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const p of piezas) {
    const ml = calcTapacantoMl(p)
    if (ml === 0) continue
    const key = p.tapacantoColor || 'General'
    result[key] = (result[key] || 0) + ml
  }
  return result
}

// Codifica/decodifica el color en el array de tapacanto (almacenado como "_color:X")
export function extractTapacantoColor(arr: string[]): { lados: string[]; color: string } {
  const colorEntry = arr.find((s) => s.startsWith('_color:'))
  return {
    lados: arr.filter((s) => !s.startsWith('_color:')),
    color: colorEntry ? colorEntry.slice(7) : '',
  }
}
export function packTapacantoColor(lados: string[], color: string): string[] {
  return color ? [...lados, `_color:${color}`] : lados
}

// TAPACANTO_COLORS kept as legacy fallback when no canto resources exist
export const TAPACANTO_COLORS_FALLBACK = [
  { value: 'Blanco', label: 'Blanco' },
  { value: 'Blanco Roto', label: 'Blanco Roto' },
  { value: 'Gris Perla', label: 'Gris Perla' },
  { value: 'Gris', label: 'Gris' },
  { value: 'Negro', label: 'Negro' },
  { value: 'Wengué', label: 'Wengué' },
  { value: 'Roble', label: 'Roble' },
  { value: 'Haya', label: 'Haya' },
  { value: 'Cerezo', label: 'Cerezo' },
  { value: 'Aluminio', label: 'Aluminio' },
]

/** Consumo agrupado por tipo de tablero (memo del editor; lo consume el tab Resumen). */
export interface TableroGroup {
  nombre: string
  mat: MaterialRef | null
  areaM2: number
  tapacantoMl: number
  boardW: number
  boardH: number
  boardAreaM2: number
  planchas: number
  pctUso: number
}

// ── Nesting (Shelf Packing) ───────────────────────────────────────────────────

export const NEST_COLORS = [
  '#bfdbfe','#bbf7d0','#fef08a','#fed7aa','#e9d5ff',
  '#fbcfe8','#bae6fd','#a7f3d0','#fde68a','#ddd6fe',
  '#99f6e4','#fecaca','#d9f99d','#e0e7ff','#fef3c7',
]

export interface NestPieceIn { key: string; etiqueta: string; nombre: string; w: number; h: number }
export interface PlacedPiece extends NestPieceIn { x: number; y: number; rotada: boolean; colorIdx: number }
export interface NestSheet { id: number; piezas: PlacedPiece[] }

export interface NestGroup {
  tablero: string
  boardW: number
  boardH: number
  sheets: NestSheet[]
  totalPiezaAreaMm2: number
  totalSheetAreaMm2: number
  aprovechamiento: number
}

export function runNesting(
  piezas: PiezaLine[],
  materialTablero: MaterialRef | null,
  tableros: MaterialRef[],
  kerf: number,
  allowRotation: boolean,
): NestGroup[] {
  // 1. Group pieces by tablero name, expanding by quantity
  const groups: Record<string, { mat: MaterialRef | null; pieces: NestPieceIn[] }> = {}
  piezas.forEach((p) => {
    const key = p.material || materialTablero?.nombre || 'Sin tablero'
    if (!groups[key]) {
      const mat = tableros.find((t) => t.nombre === key) ?? materialTablero
      groups[key] = { mat: mat ?? null, pieces: [] }
    }
    for (let i = 0; i < p.cantidad; i++) {
      groups[key].pieces.push({ key: `${p._key}-${i}`, etiqueta: p.etiqueta, nombre: p.nombre, w: p.largo, h: p.ancho })
    }
  })

  return Object.entries(groups).map(([tablero, g]) => {
    const boardW = g.mat?.largoMm ?? 2800
    const boardH = g.mat?.anchoMm ?? 2080

    // 2. Orient pieces (landscape when rotation allowed) and sort by height desc
    const oriented = g.pieces.map((p) => {
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
      let pw = p.w, ph = p.h, rotada = p.rotada
      // Skip pieces too large for any sheet
      if (pw > boardW || ph > boardH) {
        // Try swapping if rotation allowed
        if (allowRotation && p.h <= boardW && p.w <= boardH) { pw = p.h; ph = p.w; rotada = !rotada }
        else continue
      }

      const place = () => {
        sheetPiezas.push({ ...p, w: pw, h: ph, x: shelfX, y: shelfY, rotada, colorIdx: colorIdx++ % NEST_COLORS.length })
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
        // Still doesn't fit (piece wider than board) → skip
        continue
      }
      place()
    }
    if (sheetPiezas.length > 0) sheets.push({ id: sheets.length + 1, piezas: sheetPiezas })

    const totalPiezaAreaMm2 = g.pieces.reduce((acc, p) => acc + p.w * p.h, 0)
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

// ── SVG de plancha ─────────────────────────────────────────────────────────────

export function NestingSVG({ sheet, boardW, boardH }: { sheet: NestSheet; boardW: number; boardH: number }) {
  const displayW = 460
  const scale = displayW / boardW
  const displayH = Math.round(boardH * scale)
  return (
    <svg width={displayW} height={displayH} className="border border-border rounded-lg bg-muted/40" style={{ maxWidth: '100%' }}>
      <rect x={0} y={0} width={displayW} height={displayH} fill="#f8fafc" />
      {sheet.piezas.map((p) => {
        const x = Math.round(p.x * scale)
        const y = Math.round(p.y * scale)
        const w = Math.max(1, Math.round(p.w * scale))
        const h = Math.max(1, Math.round(p.h * scale))
        const fill = NEST_COLORS[p.colorIdx]
        return (
          <g key={p.key}>
            <rect x={x} y={y} width={w} height={h} fill={fill} stroke="#94a3b8" strokeWidth={0.5} />
            {w > 18 && h > 10 && (
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(9, w / (p.etiqueta.length * 0.7), h * 0.55)} fill="#1e293b" fontFamily="monospace" fontWeight="600">
                {p.etiqueta}
              </text>
            )}
            {p.rotada && w > 14 && h > 14 && (
              <text x={x + 2} y={y + 9} fontSize={7} fill="#64748b">↻</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Auto-generación de despiece ───────────────────────────────────────────────

export function generarDespiece(
  tipo: string,
  ancho: number, alto: number, prof: number,
  cantPuertas: number, cantCajones: number,
  esp: number = 18,
): PiezaLine[] {
  const piezas: PiezaLine[] = []

  // Repisa: solo una tabla (módulo aéreo simple, sin laterales/fondo/soporte)
  if (tipo === 'Repisa') {
    piezas.push({
      _key: newKey(), etiqueta: 'Rep', nombre: 'Repisa', tipoPieza: 'repisa',
      largo: ancho, ancho: prof, cantidad: 1, espesor: esp, material: '',
      tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], tapacantoColor: '',
      llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
    })
    return piezas
  }

  const anchoInt = ancho - 2 * esp

  piezas.push(
    {
      _key: newKey(), etiqueta: 'Lat', nombre: 'Lateral', tipoPieza: 'lateral',
      largo: alto, ancho: prof, cantidad: 2, espesor: esp, material: '',
      tapacanto: ['izquierdo'], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Piso', nombre: 'Piso', tipoPieza: 'piso',
      largo: anchoInt, ancho: prof, cantidad: 1, espesor: esp, material: '',
      tapacanto: ['izquierdo'], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Fondo', nombre: 'Fondo', tipoPieza: 'fondo',
      largo: alto - esp, ancho: anchoInt, cantidad: 1, espesor: 6, material: 'HDF 6mm',
      tapacanto: [], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Sop', nombre: 'Soporte', tipoPieza: 'soporte',
      largo: anchoInt, ancho: 100, cantidad: 2, espesor: esp, material: '',
      tapacanto: ['superior'], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
    },
  )

  // Puertas: siempre si cantPuertas > 0 (independiente del tipoModulo)
  // Gap de 2mm entre puertas cuando hay 2 o más
  if (cantPuertas > 0) {
    const gapTotal = (cantPuertas - 1) * 2          // 2mm entre cada par de puertas
    const anchoPuerta = Math.round((ancho - 3 - gapTotal) / cantPuertas)
    const altoPuerta = alto - esp - 2
    piezas.push({
      _key: newKey(), etiqueta: 'Puerta', nombre: 'Puerta', tipoPieza: 'puerta',
      largo: altoPuerta, ancho: anchoPuerta, cantidad: cantPuertas, espesor: esp, material: '',
      tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], tapacantoColor: '', llevaMecanizado: true, tipoMecanizado: 'bisagras', observaciones: '',
    })
  }

  // Cajones: siempre si cantCajones > 0 (incluye F-Caj, T-Caj, Fd-Caj)
  if (cantCajones > 0) {
    const altoCajonFrente = Math.round((alto - esp - cantCajones * 3) / cantCajones)
    const anchoCajon = anchoInt - 3
    const anchoCajonInt = anchoInt - 34
    const altoCajonInt = altoCajonFrente - 20
    const profFondo = prof - 20

    piezas.push(
      {
        _key: newKey(), etiqueta: 'F-Caj', nombre: 'Frente de Cajón', tipoPieza: 'frente_cajon',
        largo: altoCajonFrente, ancho: anchoCajon, cantidad: cantCajones, espesor: esp, material: '',
        tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], tapacantoColor: '', llevaMecanizado: true, tipoMecanizado: 'minifix', observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'T-Caj', nombre: 'Trasero de Cajón', tipoPieza: 'trasero_cajon',
        largo: altoCajonInt, ancho: anchoCajonInt, cantidad: cantCajones, espesor: esp, material: '',
        tapacanto: [], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'Fd-Caj', nombre: 'Fondo de Cajón', tipoPieza: 'fondo_cajon',
        largo: profFondo, ancho: anchoCajonInt, cantidad: cantCajones, espesor: 6, material: 'HDF 6mm',
        tapacanto: [], tapacantoColor: '', llevaMecanizado: false, tipoMecanizado: '', observaciones: '',
      },
    )
  }

  return piezas
}
