'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Wand2, Plus, Trash2, Package, Layers, BarChart3, Settings2, Printer, Grid3x3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PiezaLine {
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
  observaciones: string
}

interface MaterialModuloLine {
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

interface MaterialRef {
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

interface ModuloData {
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

interface Props {
  modulo: ModuloData
  materialesDisponibles: MaterialRef[]
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS_MODULO = [
  'Base con puertas', 'Base con cajones', 'Base mixto',
  'Aéreo con puertas', 'Columna', 'Closet', 'Baño', 'Oficina', 'Otro',
]

const ESTADOS_PRODUCCION = [
  'Diseño', 'En corte', 'En canteado', 'En armado', 'Instalado', 'Entregado',
]

const ETIQUETAS_PIEZA = [
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

const TAPACANTO_LADOS = [
  { key: 'superior', label: 'S', title: 'Superior' },
  { key: 'inferior', label: 'I', title: 'Inferior' },
  { key: 'izquierdo', label: 'L', title: 'Izquierdo' },
  { key: 'derecho', label: 'R', title: 'Derecho' },
]

let keyCounter = 0
const newKey = () => `k${++keyCounter}`

// ── Cálculos ──────────────────────────────────────────────────────────────────

function calcAreaM2(p: PiezaLine) {
  return (p.largo * p.ancho * p.cantidad) / 1_000_000
}

function calcTapacantoMl(p: PiezaLine) {
  let ml = 0
  if (p.tapacanto.includes('superior')) ml += p.ancho
  if (p.tapacanto.includes('inferior')) ml += p.ancho
  if (p.tapacanto.includes('izquierdo')) ml += p.largo
  if (p.tapacanto.includes('derecho')) ml += p.largo
  return (ml * p.cantidad) / 1000
}

// Agrupa ML de tapacanto por color para el resumen de materiales
function calcTapacantoByColor(piezas: PiezaLine[]): Record<string, number> {
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
function extractTapacantoColor(arr: string[]): { lados: string[]; color: string } {
  const colorEntry = arr.find((s) => s.startsWith('_color:'))
  return {
    lados: arr.filter((s) => !s.startsWith('_color:')),
    color: colorEntry ? colorEntry.slice(7) : '',
  }
}
function packTapacantoColor(lados: string[], color: string): string[] {
  return color ? [...lados, `_color:${color}`] : lados
}

const TAPACANTO_COLORS = [
  { value: '', label: '— Sin color' },
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

// ── Nesting (Shelf Packing) ───────────────────────────────────────────────────

const NEST_COLORS = [
  '#bfdbfe','#bbf7d0','#fef08a','#fed7aa','#e9d5ff',
  '#fbcfe8','#bae6fd','#a7f3d0','#fde68a','#ddd6fe',
  '#99f6e4','#fecaca','#d9f99d','#e0e7ff','#fef3c7',
]

interface NestPieceIn { key: string; etiqueta: string; nombre: string; w: number; h: number }
interface PlacedPiece extends NestPieceIn { x: number; y: number; rotada: boolean; colorIdx: number }
interface NestSheet { id: number; piezas: PlacedPiece[] }

interface NestGroup {
  tablero: string
  boardW: number
  boardH: number
  sheets: NestSheet[]
  totalPiezaAreaMm2: number
  totalSheetAreaMm2: number
  aprovechamiento: number
}

function runNesting(
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

function NestingSVG({ sheet, boardW, boardH }: { sheet: NestSheet; boardW: number; boardH: number }) {
  const displayW = 460
  const scale = displayW / boardW
  const displayH = Math.round(boardH * scale)
  return (
    <svg width={displayW} height={displayH} className="border border-slate-200 rounded-lg bg-slate-50" style={{ maxWidth: '100%' }}>
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

function generarDespiece(
  tipo: string,
  ancho: number, alto: number, prof: number,
  cantPuertas: number, cantCajones: number,
  esp: number = 18,
): PiezaLine[] {
  const piezas: PiezaLine[] = []
  const anchoInt = ancho - 2 * esp

  piezas.push(
    {
      _key: newKey(), etiqueta: 'Lat', nombre: 'Lateral', tipoPieza: 'lateral',
      largo: alto, ancho: prof, cantidad: 2, espesor: esp, material: '',
      tapacanto: ['izquierdo'], tapacantoColor: '', observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Piso', nombre: 'Piso', tipoPieza: 'piso',
      largo: anchoInt, ancho: prof, cantidad: 1, espesor: esp, material: '',
      tapacanto: ['izquierdo'], tapacantoColor: '', observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Fondo', nombre: 'Fondo', tipoPieza: 'fondo',
      largo: alto - esp, ancho: anchoInt, cantidad: 1, espesor: 6, material: 'HDF 6mm',
      tapacanto: [], tapacantoColor: '', observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Sop', nombre: 'Soporte', tipoPieza: 'soporte',
      largo: anchoInt, ancho: 100, cantidad: 2, espesor: esp, material: '',
      tapacanto: ['superior'], tapacantoColor: '', observaciones: '',
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
      tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], tapacantoColor: '', observaciones: '',
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
        tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], tapacantoColor: '', observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'T-Caj', nombre: 'Trasero de Cajón', tipoPieza: 'trasero_cajon',
        largo: altoCajonInt, ancho: anchoCajonInt, cantidad: cantCajones, espesor: esp, material: '',
        tapacanto: [], tapacantoColor: '', observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'Fd-Caj', nombre: 'Fondo de Cajón', tipoPieza: 'fondo_cajon',
        largo: profFondo, ancho: anchoCajonInt, cantidad: cantCajones, espesor: 6, material: 'HDF 6mm',
        tapacanto: [], tapacantoColor: '', observaciones: '',
      },
    )
  }

  return piezas
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ModuloEditor({ modulo, materialesDisponibles }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'datos' | 'despiece' | 'materiales' | 'resumen' | 'nesting'>('despiece')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Datos generales (proyectoId kept silently for DB)
  const proyectoId = String(modulo.proyectoId || '')
  const [codigo, setCodigo] = useState(modulo.codigo || '')
  const [tipoModulo, setTipoModulo] = useState(modulo.tipoModulo)
  const [nombre, setNombre] = useState(modulo.nombre)
  const [ancho, setAncho] = useState(String(modulo.ancho || ''))
  const [alto, setAlto] = useState(String(modulo.alto || ''))
  const [prof, setProf] = useState(String(modulo.profundidad || ''))
  const [cantPuertas, setCantPuertas] = useState(() => {
    if (modulo.cantidadPuertas > 0) return String(modulo.cantidadPuertas)
    if (modulo.tipoModulo === 'Base con puertas' || modulo.tipoModulo === 'Aéreo con puertas') return '2'
    if (modulo.tipoModulo === 'Base mixto') return '1'
    return '0'
  })
  const [cantCajones, setCantCajones] = useState(() => {
    if (modulo.cantidadCajones > 0) return String(modulo.cantidadCajones)
    if (modulo.tipoModulo === 'Base con cajones') return '3'
    if (modulo.tipoModulo === 'Base mixto') return '2'
    return '0'
  })
  const [colorAcabado, setColorAcabado] = useState(modulo.colorAcabado || '')
  const [cantidad, setCantidad] = useState(String(modulo.cantidad || 1))
  const [precioVenta, setPrecioVenta] = useState(String(modulo.precioVenta || ''))
  const [estadoProduccion, setEstadoProduccion] = useState(modulo.estadoProduccion)
  const [observaciones, setObservaciones] = useState(modulo.observaciones || '')
  const [materialTableroId, setMaterialTableroId] = useState(String(modulo.materialTableroId || ''))

  // Nesting settings
  const [nestKerf, setNestKerf] = useState(3.3)
  const [nestRotation, setNestRotation] = useState(true)

  // Despiece
  const [piezas, setPiezas] = useState<PiezaLine[]>(
    modulo.piezas.map((p) => {
      const arr = Array.isArray(p.tapacanto) ? p.tapacanto : []
      const { lados, color } = extractTapacantoColor(arr)
      return { ...p, _key: newKey(), tapacanto: lados, tapacantoColor: color }
    })
  )

  // Materiales (cantos + herrajes del módulo)
  const [materialesModulo, setMaterialesModulo] = useState<MaterialModuloLine[]>(
    modulo.materialesModulo.map((r) => {
      const mat = materialesDisponibles.find((x) => x.id === r.materialId)
      const searchLabel = mat ? `${mat.codigo ? `[${mat.codigo}] ` : ''}${mat.nombre}` : ''
      return { ...r, _key: newKey(), materialId: r.materialId ?? null, search: searchLabel }
    })
  )

  // ── Filtros derivados ────────────────────────────────────────────────────
  const tableros = materialesDisponibles.filter((m) => m.tipo === 'tablero')
  const cantosYHerrajes = materialesDisponibles.filter((m) => m.tipo === 'canto' || m.tipo === 'herraje')

  const materialTablero = tableros.find((m) => m.id === parseInt(materialTableroId))

  // ── Cálculos globales ────────────────────────────────────────────────────
  const totalAreaM2 = piezas.reduce((acc, p) => acc + calcAreaM2(p), 0)
  const totalTapacantoMl = piezas.reduce((acc, p) => acc + calcTapacantoMl(p), 0)

  // ── Consumo agrupado por tablero ─────────────────────────────────────────
  const tableroGroups = useMemo(() => {
    const groups: Record<string, { mat: MaterialRef | null; areaM2: number; tapacantoMl: number }> = {}
    piezas.forEach((p) => {
      const key = p.material || materialTablero?.nombre || 'Sin tablero'
      if (!groups[key]) {
        const mat = tableros.find((t) => t.nombre === key) ?? materialTablero
        groups[key] = { mat: mat ?? null, areaM2: 0, tapacantoMl: 0 }
      }
      groups[key].areaM2 += calcAreaM2(p)
      groups[key].tapacantoMl += calcTapacantoMl(p)
    })
    return Object.entries(groups).map(([nombre, g]) => {
      const boardW = g.mat?.largoMm ?? 2800
      const boardH = g.mat?.anchoMm ?? 2080
      const boardAreaM2 = (boardW * boardH) / 1_000_000
      const planchas = g.areaM2 > 0 ? Math.ceil((g.areaM2 * 1.15) / boardAreaM2) : 0
      return {
        nombre,
        mat: g.mat,
        areaM2: g.areaM2,
        tapacantoMl: g.tapacantoMl,
        boardW, boardH,
        boardAreaM2,
        planchas,
        pctUso: planchas > 0 ? (g.areaM2 / (planchas * boardAreaM2)) * 100 : 0,
      }
    })
  }, [piezas, materialTablero, tableros])

  // Total planchas del tablero principal (para barra inferior y costos)
  const areaPlanchaM2 = materialTablero
    ? ((materialTablero.anchoMm ?? 2080) * (materialTablero.largoMm ?? 2800)) / 1_000_000
    : (2080 * 2800) / 1_000_000
  const numPlanchas = totalAreaM2 > 0 ? Math.ceil((totalAreaM2 * 1.15) / areaPlanchaM2) : 0
  const pctUsoPlancha = numPlanchas > 0 ? (totalAreaM2 / (numPlanchas * areaPlanchaM2)) * 100 : 0

  // ── Nesting ──────────────────────────────────────────────────────────────
  const nestingGroups = useMemo(
    () => (tab === 'nesting' && piezas.length > 0
      ? runNesting(piezas, materialTablero ?? null, tableros, nestKerf, nestRotation)
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, piezas, materialTablero, tableros, nestKerf, nestRotation],
  )

  // ── Cálculos de costo ────────────────────────────────────────────────────
  // Suma proporcional de TODOS los tableros usados en el módulo
  const costoTablero = tableroGroups.reduce((acc, g) =>
    acc + (g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * (g.mat?.precio || 0) : 0), 0)
  const pctProporcionalTablero = areaPlanchaM2 > 0 ? (totalAreaM2 / areaPlanchaM2) * 100 : 0
  const totalMateriales = materialesModulo.reduce((acc, r) => acc + r.subtotal, 0)
  const costoTotal = costoTablero + totalMateriales
  const pv = parseFloat(precioVenta) || 0
  const margen = pv > 0 ? ((pv - costoTotal) / pv) * 100 : 0

  // ── Handlers piezas ──────────────────────────────────────────────────────

  const addPieza = () => {
    setPiezas((prev) => [
      ...prev,
      {
        _key: newKey(), etiqueta: 'Lat', nombre: 'Lateral', tipoPieza: 'lateral',
        largo: 0, ancho: 0, cantidad: 1, espesor: materialTablero?.espesorMm ?? 18,
        material: '', tapacanto: [], tapacantoColor: '', observaciones: '',
      },
    ])
  }

  const removePieza = (key: string) => setPiezas((prev) => prev.filter((p) => p._key !== key))

  const updatePieza = useCallback((key: string, field: keyof PiezaLine, value: unknown) => {
    setPiezas((prev) => prev.map((p) => {
      if (p._key !== key) return p
      if (field === 'etiqueta') {
        const autoNombre: Record<string, string> = {
          Lat: 'Lateral', Piso: 'Piso', Fondo: 'Fondo', Sop: 'Soporte',
          Techo: 'Techo', Div: 'División', Repi: 'Repisa', Puerta: 'Puerta',
          'F-Caj': 'Frente de Cajón', 'T-Caj': 'Trasero de Cajón',
          'Fd-Caj': 'Fondo de Cajón', Otro: '',
        }
        return { ...p, etiqueta: value as string, nombre: autoNombre[value as string] ?? '' }
      }
      return { ...p, [field]: value }
    }))
  }, [])

  const toggleTapacanto = (key: string, lado: string) => {
    setPiezas((prev) => prev.map((p) => {
      if (p._key !== key) return p
      const has = p.tapacanto.includes(lado)
      return { ...p, tapacanto: has ? p.tapacanto.filter((l) => l !== lado) : [...p.tapacanto, lado] }
    }))
  }

  const handleGenerar = () => {
    const a = parseFloat(ancho) || 0
    const h = parseFloat(alto) || 0
    const p = parseFloat(prof) || 0
    const cp = parseInt(cantPuertas) || 0
    const cc = parseInt(cantCajones) || 0
    if (a <= 0 || h <= 0 || p <= 0) {
      setError('Ingresa ancho, alto y profundidad antes de generar el despiece.')
      return
    }
    const esp = materialTablero?.espesorMm ?? 18
    setPiezas(generarDespiece(tipoModulo, a, h, p, cp, cc, esp))
    setTab('despiece')
    setError(null)
  }

  // ── Handlers materiales del módulo ───────────────────────────────────────

  const addMaterial = () => {
    setMaterialesModulo((prev) => [
      ...prev,
      { _key: newKey(), materialId: null, tipo: 'herraje', unidad: 'ud', cantidad: 1, costoSnapshot: 0, subtotal: 0, observaciones: '', search: '' },
    ])
  }

  const removeMaterial = (key: string) => setMaterialesModulo((prev) => prev.filter((r) => r._key !== key))

  const updateMaterial = (key: string, field: keyof MaterialModuloLine, value: unknown) => {
    setMaterialesModulo((prev) => prev.map((r) => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: value }
      if (field === 'materialId') {
        const mat = materialesDisponibles.find((x) => x.id === Number(value))
        if (mat) {
          updated.tipo = mat.tipo
          updated.unidad = mat.unidad
          updated.costoSnapshot = mat.precio
          updated.subtotal = r.cantidad * mat.precio
        }
      }
      if (field === 'cantidad' || field === 'costoSnapshot') {
        const cant = field === 'cantidad' ? Number(value) : updated.cantidad
        const costo = field === 'costoSnapshot' ? Number(value) : updated.costoSnapshot
        updated.subtotal = cant * costo
      }
      return updated
    }))
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true); setError(null); setSaved(false)

    try {
      const payload = {
        proyectoId: proyectoId ? parseInt(proyectoId) : null,
        codigo: codigo || null,
        tipoModulo,
        nombre: nombre.trim(),
        ancho: parseFloat(ancho) || 0,
        alto: parseFloat(alto) || 0,
        profundidad: parseFloat(prof) || 0,
        cantidadPuertas: parseInt(cantPuertas) || 0,
        cantidadCajones: parseInt(cantCajones) || 0,
        material: materialTablero?.nombre || '',
        colorAcabado: colorAcabado || null,
        cantidad: parseInt(cantidad) || 1,
        costoMateriales: costoTablero,
        costoManoObra: 0,
        costoInstalacion: 0,
        precioVenta: parseFloat(precioVenta) || 0,
        estadoProduccion,
        observaciones: observaciones || null,
        materialTableroId: materialTableroId ? parseInt(materialTableroId) : null,
        anchoPlanchaCm: materialTablero?.anchoMm ?? 2440,
        largoPlanchaCm: materialTablero?.largoMm ?? 1830,
        piezas: piezas.map(({ _key, id: _id, tapacantoColor, tapacanto, ...p }) => ({
          ...p,
          tapacanto: packTapacantoColor(tapacanto, tapacantoColor),
        })),
        materialesModulo: materialesModulo.map(({ _key, id: _id, search: _s, ...r }) => r),
      }

      const res = await fetch(`/api/melamina/${modulo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al guardar')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  const inputCls = 'w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50'

  return (
    <div className="space-y-4 pb-32 print:pb-0">
      {/* Header (oculto al imprimir) */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/melamina"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{nombre || 'Módulo sin nombre'}</h1>
            <p className="text-sm text-slate-500">{codigo && <span className="font-mono mr-2">{codigo}</span>}{tipoModulo}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">{error}</div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm">Guardado correctamente.</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 print:hidden">
        {([
          { key: 'datos', label: 'Datos', icon: <Settings2 className="w-3.5 h-3.5" /> },
          { key: 'despiece', label: 'Despiece', icon: <Layers className="w-3.5 h-3.5" /> },
          { key: 'nesting', label: 'Nesting', icon: <Grid3x3 className="w-3.5 h-3.5" /> },
          { key: 'materiales', label: 'Materiales', icon: <Package className="w-3.5 h-3.5" /> },
          { key: 'resumen', label: 'Resumen', icon: <BarChart3 className="w-3.5 h-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: DATOS ──────────────────────────────────────────────────────── */}
      {tab === 'datos' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 print:hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
              <input className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="B90-Fre" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select className={inputCls + ' bg-white'} value={tipoModulo} onChange={(e) => setTipoModulo(e.target.value)}>
                {TIPOS_MODULO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Base 90 con puertas" />
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ancho (mm)</label>
              <input type="number" className={inputCls} value={ancho} onChange={(e) => setAncho(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alto (mm)</label>
              <input type="number" className={inputCls} value={alto} onChange={(e) => setAlto(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prof. (mm)</label>
              <input type="number" className={inputCls} value={prof} onChange={(e) => setProf(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Puertas</label>
              <input type="number" className={inputCls} value={cantPuertas} onChange={(e) => setCantPuertas(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cajones</label>
              <input type="number" className={inputCls} value={cantCajones} onChange={(e) => setCantCajones(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
              <input type="number" className={inputCls} value={cantidad} onChange={(e) => setCantidad(e.target.value)} min="1" step="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tablero principal</label>
              <select
                className={inputCls + ' bg-white'}
                value={materialTableroId}
                onChange={(e) => setMaterialTableroId(e.target.value)}
              >
                <option value="">— Sin tablero vinculado —</option>
                {tableros.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo ? `[${t.codigo}] ` : ''}{t.nombre}
                    {t.anchoMm && t.largoMm ? ` (${t.anchoMm}×${t.largoMm}${t.espesorMm ? `×${t.espesorMm}mm` : 'mm'})` : ''}
                  </option>
                ))}
              </select>
              {materialTablero && (
                <p className="text-xs text-slate-400 mt-1">
                  Área: {(((materialTablero.anchoMm ?? 0) * (materialTablero.largoMm ?? 0)) / 1_000_000).toFixed(4)} m² / plancha
                  {materialTablero.precio > 0 && ` · ${formatCurrency(materialTablero.precio)} / plancha`}
                </p>
              )}
              {tableros.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Sin tableros en catálogo.{' '}
                  <a href="/melamina/materiales" className="underline">Agregar en Materiales</a>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Color/Acabado</label>
              <input className={inputCls} value={colorAcabado} onChange={(e) => setColorAcabado(e.target.value)} placeholder="Blanco Alpino" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado producción</label>
              <select className={inputCls + ' bg-white'} value={estadoProduccion} onChange={(e) => setEstadoProduccion(e.target.value)}>
                {ESTADOS_PRODUCCION.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio de venta</label>
              <input type="number" className={inputCls} value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} min="0" step="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
              <input className={inputCls} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del módulo" />
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: DESPIECE ───────────────────────────────────────────────────── */}
      {tab === 'despiece' && (
        <div className="space-y-3 print:hidden">
          {/* Generar */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-800">Generación automática de despiece</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Basado en: {ancho || '?'}×{alto || '?'}×{prof || '?'} mm — {cantPuertas} puerta(s) — {cantCajones} cajón(es)
                {materialTablero?.espesorMm && <span> — Espesor: {materialTablero.espesorMm}mm</span>}
              </p>
            </div>
            <div className="flex gap-2">
              {piezas.length > 0 && (
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer className="w-4 h-4" /> Imprimir
                </Button>
              )}
              <Button variant="secondary" onClick={handleGenerar}>
                <Wand2 className="w-4 h-4" /> Generar despiece
              </Button>
            </div>
          </div>

          {/* Tabla de piezas */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className={thCls} style={{ width: 110 }}>Etiqueta</th>
                    <th className={thCls}>Nombre</th>
                    <th className={thCls} style={{ width: 80 }}>Largo (mm)</th>
                    <th className={thCls} style={{ width: 80 }}>Ancho (mm)</th>
                    <th className={thCls} style={{ width: 60 }}>Cant.</th>
                    <th className={thCls} style={{ width: 70 }}>Esp. (mm)</th>
                    <th className={thCls} style={{ width: 160 }}>Tablero</th>
                    <th className={thCls} style={{ width: 100 }}>Tapacanto</th>
                    <th className={thCls} style={{ width: 80 }}>Área m²</th>
                    <th className={thCls} style={{ width: 70 }}>TC ml</th>
                    <th className={thCls} style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {piezas.map((p) => {
                    const area = calcAreaM2(p)
                    const tc = calcTapacantoMl(p)
                    // check if piece fits in tablero
                    const fitsAncho = materialTablero?.anchoMm ? p.ancho <= materialTablero.anchoMm : null
                    const fitsLargo = materialTablero?.largoMm ? p.largo <= materialTablero.largoMm : null
                    const noFit = fitsAncho === false || fitsLargo === false
                    return (
                      <tr key={p._key} className={`hover:bg-slate-50/50 ${noFit ? 'bg-red-50/40' : ''}`}>
                        <td className="px-2 py-1.5">
                          <select
                            className="border border-slate-200 rounded-md px-1.5 py-1 text-xs bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.etiqueta}
                            onChange={(e) => updatePieza(p._key, 'etiqueta', e.target.value)}
                          >
                            {ETIQUETAS_PIEZA.map((et) => (
                              <option key={et.value} value={et.value}>{et.value}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.nombre}
                            onChange={(e) => updatePieza(p._key, 'nombre', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.1"
                            className={`border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500 ${fitsLargo === false ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                            value={p.largo}
                            onChange={(e) => updatePieza(p._key, 'largo', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.1"
                            className={`border rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500 ${fitsAncho === false ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                            value={p.ancho}
                            onChange={(e) => updatePieza(p._key, 'ancho', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="1" step="1"
                            className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.cantidad}
                            onChange={(e) => updatePieza(p._key, 'cantidad', parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="1"
                            className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.espesor}
                            onChange={(e) => updatePieza(p._key, 'espesor', parseFloat(e.target.value) || 18)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="border border-slate-200 rounded-md px-1.5 py-1 text-xs bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.material}
                            onChange={(e) => updatePieza(p._key, 'material', e.target.value)}
                          >
                            <option value="">Heredar{materialTablero ? ` (${materialTablero.nombre})` : ''}</option>
                            {tableros.map((t) => (
                              <option key={t.id} value={t.nombre}>{t.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-0.5">
                              {TAPACANTO_LADOS.map((l) => (
                                <button
                                  key={l.key}
                                  title={l.title}
                                  onClick={() => toggleTapacanto(p._key, l.key)}
                                  className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                                    p.tapacanto.includes(l.key)
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                  }`}
                                >
                                  {l.label}
                                </button>
                              ))}
                            </div>
                            {p.tapacanto.length > 0 && (
                              <select
                                value={p.tapacantoColor}
                                onChange={(e) => updatePieza(p._key, 'tapacantoColor', e.target.value)}
                                title="Color del tapacanto"
                                className="border border-amber-200 rounded px-1 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-800 w-full"
                              >
                                {TAPACANTO_COLORS.map((c) => (
                                  <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs text-slate-600 font-mono">{area.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right text-xs text-amber-700 font-mono">{tc.toFixed(2)}</td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removePieza(p._key)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {piezas.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={8} className="px-3 py-2 text-xs font-semibold text-slate-600">Totales</td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-slate-800 font-mono">{totalAreaM2.toFixed(4)} m²</td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-amber-700 font-mono">{totalTapacantoMl.toFixed(2)} ml</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={addPieza}>
                <Plus className="w-3.5 h-3.5" /> Agregar pieza
              </Button>
            </div>
          </div>

          {/* Consumo de tablero — agrupado por tipo */}
          {piezas.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Consumo de tablero</p>
                <span className="text-xs text-slate-400">
                {totalAreaM2.toFixed(3)} m² · {totalTapacantoMl.toFixed(2)} ml canto
                {Object.entries(calcTapacantoByColor(piezas)).map(([color, ml]) => (
                  <span key={color} className="ml-2 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-[10px]">
                    {color}: {ml.toFixed(2)} ml
                  </span>
                ))}
              </span>
              </div>
              <div className="space-y-2">
                {tableroGroups.map((g) => (
                  <div key={g.nombre} className="border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">{g.nombre}</span>
                      <span className="text-xs text-slate-400">{g.boardW}×{g.boardH} mm</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Área piezas</p>
                        <p className="text-sm font-bold text-slate-800">{g.areaM2.toFixed(3)} m²</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Planchas (+15%)</p>
                        <p className="text-sm font-bold text-blue-700">{g.planchas}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">% uso plancha</p>
                        <p className={`text-sm font-bold ${g.pctUso >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                          {g.pctUso.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tapacanto</p>
                        <p className="text-sm font-bold text-amber-700">{g.tapacantoMl.toFixed(2)} ml</p>
                      </div>
                    </div>
                    {/* Barra de uso */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${g.pctUso >= 70 ? 'bg-green-500' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(100, g.pctUso)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setTab('nesting')}
                className="w-full text-xs text-blue-600 hover:text-blue-800 py-1.5 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Ver optimización de corte (Nesting) →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: NESTING ────────────────────────────────────────────────────── */}
      {tab === 'nesting' && (
        <div className="space-y-4 print:hidden">
          {/* Configuración */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Configuración de optimización</p>
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Kerf (espesor de corte)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="0" max="10" step="0.5"
                    value={nestKerf}
                    onChange={(e) => setNestKerf(parseFloat(e.target.value) || 0)}
                    className="border border-slate-200 rounded-md px-2.5 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-400">mm</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rotación de piezas</label>
                <button
                  onClick={() => setNestRotation((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    nestRotation
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <span>{nestRotation ? '✓ Permitida' : 'Desactivada'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-400 max-w-xs">
                Algoritmo Shelf — ordena piezas de mayor a menor, empaqueta en filas dentro de cada plancha.
              </div>
            </div>
          </div>

          {piezas.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
              Agrega piezas en el tab Despiece para ver la optimización de corte.
            </div>
          ) : nestingGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
              Calculando…
            </div>
          ) : (
            nestingGroups.map((ng) => (
              <div key={ng.tablero} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Tablero header */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{ng.tablero}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Plancha {ng.boardW}×{ng.boardH} mm ·
                      <span className="text-blue-700 font-semibold ml-1">{ng.sheets.length} plancha{ng.sheets.length !== 1 ? 's' : ''}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${ng.aprovechamiento >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                      {ng.aprovechamiento.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-400">aprovechamiento</p>
                  </div>
                </div>

                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">Área total piezas</p>
                    <p className="text-sm font-bold text-slate-800">{(ng.totalPiezaAreaMm2 / 1_000_000).toFixed(3)} m²</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Área total planchas</p>
                    <p className="text-sm font-bold text-slate-800">{(ng.totalSheetAreaMm2 / 1_000_000).toFixed(3)} m²</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Desperdicio</p>
                    <p className="text-sm font-bold text-red-600">
                      {((ng.totalSheetAreaMm2 - ng.totalPiezaAreaMm2) / 1_000_000).toFixed(3)} m²
                    </p>
                  </div>
                </div>

                {/* SVG por plancha */}
                <div className="p-4 space-y-4">
                  {ng.sheets.map((sheet) => (
                    <div key={sheet.id}>
                      <p className="text-xs text-slate-500 mb-1.5 font-medium">
                        Plancha {sheet.id} — {sheet.piezas.length} pieza{sheet.piezas.length !== 1 ? 's' : ''}
                      </p>
                      <NestingSVG sheet={sheet} boardW={ng.boardW} boardH={ng.boardH} />
                      {/* Leyenda */}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Array.from(new Set(sheet.piezas.map((p) => p.etiqueta))).map((et) => {
                          const p = sheet.piezas.find((x) => x.etiqueta === et)!
                          return (
                            <span key={et} className="flex items-center gap-1 text-xs text-slate-600 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">
                              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: NEST_COLORS[p.colorIdx] }} />
                              {et} — {p.nombre}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: MATERIALES ─────────────────────────────────────────────────── */}
      {tab === 'materiales' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:hidden">
          {cantosYHerrajes.length === 0 && (
            <div className="px-5 pt-4 pb-0">
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No hay cantos ni herrajes en el catálogo.{' '}
                <a href="/melamina/materiales" className="underline font-medium">Agregar en Materiales</a>
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={thCls}>Canto / Herraje (buscar)</th>
                  <th className={thCls} style={{ width: 70 }}>Tipo</th>
                  <th className={thCls} style={{ width: 80 }}>Unidad</th>
                  <th className={thCls} style={{ width: 80 }}>Cantidad</th>
                  <th className={thCls} style={{ width: 100 }}>Costo unit.</th>
                  <th className={thCls} style={{ width: 110 }}>Subtotal</th>
                  <th className={thCls}>Observaciones</th>
                  <th className={thCls} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materialesModulo.map((r) => (
                  <tr key={r._key} className="hover:bg-slate-50/50">
                    <td className="px-2 py-1.5">
                      <input
                        list={`mats-${r._key}`}
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Buscar canto o herraje..."
                        value={r.search}
                        onChange={(e) => {
                          const val = e.target.value
                          setMaterialesModulo((prev) => prev.map((row) => {
                            if (row._key !== r._key) return row
                            const updated = { ...row, search: val }
                            const match = cantosYHerrajes.find((m) =>
                              `${m.codigo ? `[${m.codigo}] ` : ''}${m.nombre}` === val || m.nombre === val
                            )
                            if (match) {
                              updated.materialId = match.id
                              updated.tipo = match.tipo
                              updated.unidad = match.unidad
                              updated.costoSnapshot = match.precio
                              updated.subtotal = row.cantidad * match.precio
                            }
                            return updated
                          }))
                        }}
                      />
                      <datalist id={`mats-${r._key}`}>
                        {cantosYHerrajes.map((m) => (
                          <option key={m.id} value={`${m.codigo ? `[${m.codigo}] ` : ''}${m.nombre}`} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                        r.tipo === 'canto' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.tipo || '—'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.unidad}
                        onChange={(e) => updateMaterial(r._key, 'unidad', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.cantidad}
                        onChange={(e) => updateMaterial(r._key, 'cantidad', parseFloat(e.target.value) || 0)}
                      />
                      {r.tipo === 'canto' && totalTapacantoMl > 0 && (
                        <button
                          type="button"
                          onClick={() => updateMaterial(r._key, 'cantidad', parseFloat(totalTapacantoMl.toFixed(2)))}
                          className="text-xs text-amber-600 hover:text-amber-800 underline mt-0.5 block w-full text-right"
                          title="Usar el total de tapacanto calculado de las piezas"
                        >
                          ↺ {totalTapacantoMl.toFixed(2)} ml
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.costoSnapshot}
                        onChange={(e) => updateMaterial(r._key, 'costoSnapshot', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-bold text-slate-800 pr-4 font-mono">
                      {formatCurrency(r.subtotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.observaciones}
                        onChange={(e) => updateMaterial(r._key, 'observaciones', e.target.value)}
                        placeholder="Nota..."
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeMaterial(r._key)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {materialesModulo.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">
                      No hay cantos ni herrajes. Usa el botón para agregar.
                    </td>
                  </tr>
                )}
              </tbody>
              {materialesModulo.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-slate-600">Total cantos + herrajes</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-slate-800 pr-4 font-mono">
                      {formatCurrency(totalMateriales)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={addMaterial}>
              <Plus className="w-3.5 h-3.5" /> Agregar material
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: RESUMEN ────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-4 print:hidden">
          {/* Tablero — distribución por tipo */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Distribución de tableros</p>
              <span className="text-xs text-slate-400">{piezas.length} piezas · {totalAreaM2.toFixed(3)} m² total</span>
            </div>
            {tableroGroups.length === 0 ? (
              <p className="text-sm text-slate-400">Sin piezas definidas.</p>
            ) : (
              <div className="space-y-3">
                {tableroGroups.map((g) => {
                  const costoG = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * (g.mat?.precio || 0) : 0
                  const pctPlancha = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * 100 : 0
                  return (
                    <div key={g.nombre} className="border border-slate-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{g.nombre}</span>
                        <span className="text-sm font-bold text-slate-800">{formatCurrency(costoG)}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-slate-400">Área usada</p>
                          <p className="font-semibold text-slate-700">{g.areaM2.toFixed(3)} m²</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Plancha ({g.boardW}×{g.boardH})</p>
                          <p className="font-semibold text-slate-700">{g.boardAreaM2.toFixed(3)} m²</p>
                        </div>
                        <div>
                          <p className="text-slate-400">% plancha consumida</p>
                          <p className={`font-bold ${pctPlancha >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                            {pctPlancha.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Precio plancha</p>
                          <p className="font-semibold text-slate-700">{g.mat?.precio ? formatCurrency(g.mat.precio) : '—'}</p>
                        </div>
                      </div>
                      {/* Barra visual de uso */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${pctPlancha >= 70 ? 'bg-green-500' : 'bg-amber-400'}`}
                            style={{ width: `${Math.min(100, pctPlancha)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-20 text-right">
                          {pctPlancha.toFixed(1)}% × {formatCurrency(g.mat?.precio || 0)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Tapacanto: {g.tapacantoMl.toFixed(2)} ml
                        {Object.entries(calcTapacantoByColor(piezas.filter((p) =>
                          (p.material || materialTablero?.nombre || 'Sin tablero') === g.nombre
                        ))).map(([color, ml]) => (
                          <span key={color} className="ml-2 px-1 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-[10px]">
                            {color}: {ml.toFixed(2)} ml
                          </span>
                        ))}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cantos y Herrajes */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Cantos y Herrajes ({materialesModulo.length})
            </p>
            {materialesModulo.length === 0 ? (
              <p className="text-sm text-slate-400">Sin cantos ni herrajes agregados.</p>
            ) : (
              <div className="space-y-1.5">
                {materialesModulo.map((r) => {
                  const mat = materialesDisponibles.find((x) => x.id === r.materialId)
                  return (
                    <div key={r._key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {mat?.nombre || r.search || 'Material'}
                        {r.tipo === 'canto'
                          ? <span className="text-xs text-slate-500 ml-1">— {r.cantidad} {r.unidad} × {formatCurrency(r.costoSnapshot)}/{r.unidad}</span>
                          : <span className="text-xs text-slate-500 ml-1">— {r.cantidad} {r.unidad}</span>
                        }
                        {r.tipo && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${r.tipo === 'canto' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {r.tipo}
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-slate-800">{formatCurrency(r.subtotal)}</span>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between text-sm font-bold border-t border-slate-100 pt-1.5 mt-2">
                  <span className="text-slate-700">Total cantos + herrajes</span>
                  <span className="text-slate-800">{formatCurrency(totalMateriales)}</span>
                </div>
                {costoTotal > 0 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span className="w-4 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, (totalMateriales / costoTotal) * 100)}%` }} />
                    </div>
                    <span className="w-10 text-right shrink-0">{((totalMateriales / costoTotal) * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resumen de costos */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Resumen de costos</p>
            <div className="space-y-2">
              {/* Tablero: una línea por cada tipo con su costo proporcional */}
              {tableroGroups.map((g) => {
                const costoG = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * (g.mat?.precio || 0) : 0
                const pctG   = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * 100 : 0
                return (
                  <div key={g.nombre} className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {g.nombre}
                      <span className="text-xs text-slate-400 ml-1">({pctG.toFixed(1)}% plancha)</span>
                    </span>
                    <span className="font-medium">{formatCurrency(costoG)}</span>
                  </div>
                )
              })}
              {tableroGroups.length > 1 && (
                <div className="flex justify-between text-xs text-slate-500 border-t border-dashed border-slate-200 pt-1">
                  <span>Subtotal tableros</span>
                  <span className="font-semibold">{formatCurrency(costoTablero)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Cantos y Herrajes</span>
                <span className="font-medium">{formatCurrency(totalMateriales)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-800">Costo estimado total</span>
                <span className="text-slate-800">{formatCurrency(costoTotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-600">Precio de venta</span>
                <input
                  type="number" min="0" step="1"
                  className="border border-slate-200 rounded-md px-2 py-0.5 text-sm text-right w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                />
              </div>
              <div className={`flex justify-between text-sm font-bold ${margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                <span>Margen estimado</span>
                <span>{margen.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">Total módulo × {cantidad} unidad(es)</p>
              <p className="text-xs text-blue-600 mt-0.5">Precio de venta total</p>
            </div>
            <p className="text-2xl font-bold text-blue-800">{formatCurrency(pv * (parseInt(cantidad) || 1))}</p>
          </div>
        </div>
      )}

      {/* ── VISTA DE IMPRESIÓN (solo visible al imprimir) ──────────────────── */}
      <div className="hidden print:block text-black text-sm">
        <div className="mb-4">
          <h1 className="text-lg font-bold">{nombre || 'Módulo'} — Lista de Corte</h1>
          <p className="text-xs text-gray-600">
            {tipoModulo} · {ancho}×{alto}×{prof} mm
            {materialTablero && ` · Tablero: ${materialTablero.nombre} (${materialTablero.espesorMm ?? 18}mm)`}
            {` · ${numPlanchas} plancha${numPlanchas !== 1 ? 's' : ''} necesaria${numPlanchas !== 1 ? 's' : ''} (incl. 15% merma)`}
          </p>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1 pr-2">Etiq.</th>
              <th className="text-left py-1 pr-2">Nombre</th>
              <th className="text-right py-1 pr-2">Largo mm</th>
              <th className="text-right py-1 pr-2">Ancho mm</th>
              <th className="text-right py-1 pr-2">Cant.</th>
              <th className="text-right py-1 pr-2">Esp. mm</th>
              <th className="text-left py-1 pr-2">Tablero</th>
              <th className="text-left py-1 pr-2">Tapacanto</th>
              <th className="text-right py-1">Área m²</th>
            </tr>
          </thead>
          <tbody>
            {piezas.map((p) => (
              <tr key={p._key} className="border-b border-gray-300">
                <td className="py-0.5 pr-2 font-mono">{p.etiqueta}</td>
                <td className="py-0.5 pr-2">{p.nombre}</td>
                <td className="py-0.5 pr-2 text-right">{p.largo}</td>
                <td className="py-0.5 pr-2 text-right">{p.ancho}</td>
                <td className="py-0.5 pr-2 text-right">{p.cantidad}</td>
                <td className="py-0.5 pr-2 text-right">{p.espesor}</td>
                <td className="py-0.5 pr-2">{p.material || (materialTablero?.nombre ?? '—')}</td>
                <td className="py-0.5 pr-2">{p.tapacanto.map((l) => l[0].toUpperCase()).join(' ')}</td>
                <td className="py-0.5 text-right">{calcAreaM2(p).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold">
              <td colSpan={8} className="py-1">TOTAL</td>
              <td className="py-1 text-right">{totalAreaM2.toFixed(4)} m²</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-3 text-xs text-gray-500">Tapacanto total: {totalTapacantoMl.toFixed(2)} ml</p>
      </div>

      {/* Barra fija inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-20 shadow-lg print:hidden">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-slate-500 text-xs">Área</span>
            <p className="font-bold text-slate-800">{totalAreaM2.toFixed(3)} m²</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Planchas</span>
            <p className="font-bold text-blue-700">{numPlanchas}</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Tapacanto</span>
            <p className="font-bold text-amber-700">{totalTapacantoMl.toFixed(2)} ml</p>
          </div>
          <div>
            <span className="text-slate-500 text-xs">Costo est.</span>
            <p className="font-bold text-slate-800">{formatCurrency(costoTotal)}</p>
          </div>
          {pv > 0 && (
            <div>
              <span className="text-slate-500 text-xs">Margen</span>
              <p className={`font-bold ${margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margen.toFixed(1)}%</p>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  )
}
