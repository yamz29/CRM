'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Wand2, Plus, Trash2, Package, Layers, BarChart3, Settings2, Printer,
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
      tapacanto: ['izquierdo'], observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Piso', nombre: 'Piso', tipoPieza: 'piso',
      largo: anchoInt, ancho: prof, cantidad: 1, espesor: esp, material: '',
      tapacanto: ['izquierdo'], observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Fondo', nombre: 'Fondo', tipoPieza: 'fondo',
      largo: alto - esp, ancho: anchoInt, cantidad: 1, espesor: 6, material: 'HDF 6mm',
      tapacanto: [], observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Sop', nombre: 'Soporte', tipoPieza: 'soporte',
      largo: anchoInt, ancho: 100, cantidad: 2, espesor: esp, material: '',
      tapacanto: ['superior'], observaciones: '',
    },
  )

  if ((tipo === 'Base con puertas' || tipo === 'Aéreo con puertas') && cantPuertas > 0) {
    const anchoPuerta = Math.round((ancho - 3) / cantPuertas)
    const altoPuerta = alto - esp - 2
    piezas.push({
      _key: newKey(), etiqueta: 'Puerta', nombre: 'Puerta', tipoPieza: 'puerta',
      largo: altoPuerta, ancho: anchoPuerta, cantidad: cantPuertas, espesor: esp, material: '',
      tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], observaciones: '',
    })
  }

  if ((tipo === 'Base con cajones' || tipo === 'Base mixto') && cantCajones > 0) {
    const altoCajonFrente = Math.round((alto - esp - cantCajones * 3) / cantCajones)
    const anchoCajon = anchoInt - 3
    const anchoCajonInt = anchoInt - 34
    const altoCajonInt = altoCajonFrente - 20
    const profFondo = prof - 20

    piezas.push(
      {
        _key: newKey(), etiqueta: 'F-Caj', nombre: 'Frente de Cajón', tipoPieza: 'frente_cajon',
        largo: altoCajonFrente, ancho: anchoCajon, cantidad: cantCajones, espesor: esp, material: '',
        tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'], observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'T-Caj', nombre: 'Trasero de Cajón', tipoPieza: 'trasero_cajon',
        largo: altoCajonInt, ancho: anchoCajonInt, cantidad: cantCajones, espesor: esp, material: '',
        tapacanto: [], observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'Fd-Caj', nombre: 'Fondo de Cajón', tipoPieza: 'fondo_cajon',
        largo: profFondo, ancho: anchoCajonInt, cantidad: cantCajones, espesor: 6, material: 'HDF 6mm',
        tapacanto: [], observaciones: '',
      },
    )
  }

  return piezas
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ModuloEditor({ modulo, materialesDisponibles }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'datos' | 'despiece' | 'materiales' | 'resumen'>('despiece')
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
  const [cantPuertas, setCantPuertas] = useState(String(modulo.cantidadPuertas || 0))
  const [cantCajones, setCantCajones] = useState(String(modulo.cantidadCajones || 0))
  const [colorAcabado, setColorAcabado] = useState(modulo.colorAcabado || '')
  const [cantidad, setCantidad] = useState(String(modulo.cantidad || 1))
  const [precioVenta, setPrecioVenta] = useState(String(modulo.precioVenta || ''))
  const [estadoProduccion, setEstadoProduccion] = useState(modulo.estadoProduccion)
  const [observaciones, setObservaciones] = useState(modulo.observaciones || '')
  const [materialTableroId, setMaterialTableroId] = useState(String(modulo.materialTableroId || ''))

  // Despiece
  const [piezas, setPiezas] = useState<PiezaLine[]>(
    modulo.piezas.map((p) => ({ ...p, _key: newKey(), tapacanto: Array.isArray(p.tapacanto) ? p.tapacanto : [] }))
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

  // ── Cálculos de plancha ──────────────────────────────────────────────────
  const totalAreaM2 = piezas.reduce((acc, p) => acc + calcAreaM2(p), 0)
  const totalTapacantoMl = piezas.reduce((acc, p) => acc + calcTapacantoMl(p), 0)
  const areaPlanchaM2 = materialTablero
    ? ((materialTablero.anchoMm ?? 2440) * (materialTablero.largoMm ?? 1830)) / 1_000_000
    : 4.4652
  const numPlanchas = totalAreaM2 > 0 ? Math.ceil((totalAreaM2 * 1.15) / areaPlanchaM2) : 0
  const pctUsoPlancha = numPlanchas > 0 ? (totalAreaM2 / (numPlanchas * areaPlanchaM2)) * 100 : 0

  // ── Cálculos de costo ────────────────────────────────────────────────────
  const costoTablero = numPlanchas * (materialTablero?.precio || 0)
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
        largo: 0, ancho: 0, cantidad: 1, espesor: materialTablero?.espesorMm ?? 18, material: '', tapacanto: [], observaciones: '',
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
        piezas: piezas.map(({ _key, id: _id, ...p }) => p),
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

          {/* Consumo de plancha */}
          {piezas.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Consumo de tablero</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Área total piezas</p>
                  <p className="text-lg font-bold text-slate-800">{totalAreaM2.toFixed(3)} m²</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    Planchas{materialTablero ? ` de ${materialTablero.anchoMm}×${materialTablero.largoMm}mm` : ''}
                  </p>
                  <p className="text-lg font-bold text-blue-700">{numPlanchas}</p>
                  <p className="text-xs text-slate-400">({areaPlanchaM2.toFixed(3)} m² c/u · +15% merma)</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">% uso de plancha</p>
                  <p className={`text-lg font-bold ${pctUsoPlancha >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                    {pctUsoPlancha.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tapacanto total</p>
                  <p className="text-lg font-bold text-amber-700">{totalTapacantoMl.toFixed(2)} ml</p>
                </div>
              </div>
              {piezas.some((p) => {
                if (!materialTablero) return false
                return (materialTablero.anchoMm && p.ancho > materialTablero.anchoMm) ||
                       (materialTablero.largoMm && p.largo > materialTablero.largoMm)
              }) && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">
                  Algunas piezas superan las dimensiones del tablero seleccionado. Revisa los campos marcados en rojo.
                </div>
              )}
            </div>
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
          {/* Tablero */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Consumo de tablero</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Piezas</p>
                <p className="text-2xl font-bold text-slate-800">{piezas.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Área total</p>
                <p className="text-2xl font-bold text-slate-800">{totalAreaM2.toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  Planchas{materialTablero ? ` (${materialTablero.anchoMm}×${materialTablero.largoMm}mm)` : ''}
                </p>
                <p className="text-2xl font-bold text-blue-700">{numPlanchas}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tapacanto total</p>
                <p className="text-2xl font-bold text-amber-700">{totalTapacantoMl.toFixed(2)} ml</p>
              </div>
            </div>
            {materialTablero && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    <strong>{materialTablero.nombre}</strong>
                    {materialTablero.anchoMm && materialTablero.largoMm
                      ? ` — ${materialTablero.anchoMm}×${materialTablero.largoMm}${materialTablero.espesorMm ? `×${materialTablero.espesorMm}mm` : 'mm'}`
                      : ''}
                    {' — '}{numPlanchas} plancha{numPlanchas !== 1 ? 's' : ''} × {formatCurrency(materialTablero.precio)}
                  </span>
                  <span className="font-bold text-slate-800">{formatCurrency(costoTablero)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="w-4 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: costoTotal > 0 ? `${Math.min(100, (costoTablero / costoTotal) * 100)}%` : '0%' }} />
                  </div>
                  <span className="w-10 text-right shrink-0">
                    {costoTotal > 0 ? `${((costoTablero / costoTotal) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
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
                        {mat?.nombre || r.search || 'Material'} — {r.cantidad} {r.unidad}
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
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tablero ({numPlanchas} planchas)</span>
                <span className="font-medium">{formatCurrency(costoTablero)}</span>
              </div>
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
