'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Wand2, Plus, Trash2, Package, Layers, BarChart3, Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────────────────────

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

interface RecursoLine {
  _key: string
  id?: number
  recursoId: number | null
  descripcion: string
  unidad: string
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
}

interface RecursoRef {
  id: number
  nombre: string
  unidad: string
  costoUnitario: number
  tipo: string
  codigo: string | null
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
  herrajes: string | null
  cantidad: number
  costoMateriales: number
  costoManoObra: number
  costoInstalacion: number
  precioVenta: number
  estadoProduccion: string
  observaciones: string | null
  recursoTableroId: number | null
  anchoPlanchaCm: number
  largoPlanchaCm: number
  piezas: (Omit<PiezaLine, '_key'>)[]
  recursosModulo: (Omit<RecursoLine, '_key'> & {
    recurso?: RecursoRef | null
  })[]
  proyecto?: { id: number; nombre: string } | null
}

interface Props {
  modulo: ModuloData
  proyectos: { id: number; nombre: string }[]
  recursosDisponibles: RecursoRef[]
}

// ── Constantes ───────────────────────────────────────────────────────────────

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

const ESPESOR = 1.8 // cm (18mm)

let keyCounter = 0
const newKey = () => `k${++keyCounter}`

// ── Cálculos ─────────────────────────────────────────────────────────────────

function calcAreaM2(p: PiezaLine) {
  return (p.largo * p.ancho * p.cantidad) / 10000
}

function calcTapacantoMl(p: PiezaLine) {
  let ml = 0
  if (p.tapacanto.includes('superior')) ml += p.ancho
  if (p.tapacanto.includes('inferior')) ml += p.ancho
  if (p.tapacanto.includes('izquierdo')) ml += p.largo
  if (p.tapacanto.includes('derecho')) ml += p.largo
  return (ml * p.cantidad) / 100
}

// ── Auto-generación ──────────────────────────────────────────────────────────

function generarDespiece(
  tipo: string,
  ancho: number, alto: number, prof: number,
  cantPuertas: number, cantCajones: number,
): PiezaLine[] {
  const piezas: PiezaLine[] = []

  // Casco base (siempre)
  piezas.push(
    {
      _key: newKey(), etiqueta: 'Lat', nombre: 'Lateral', tipoPieza: 'lateral',
      largo: alto, ancho: prof,
      cantidad: 2, espesor: 18, material: '',
      tapacanto: ['izquierdo'], observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Piso', nombre: 'Piso', tipoPieza: 'piso',
      largo: Math.round((ancho - 2 * ESPESOR) * 10) / 10,
      ancho: prof,
      cantidad: 1, espesor: 18, material: '',
      tapacanto: ['izquierdo'], observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Fondo', nombre: 'Fondo', tipoPieza: 'fondo',
      largo: Math.round((alto - ESPESOR) * 10) / 10,
      ancho: Math.round((ancho - 2 * ESPESOR) * 10) / 10,
      cantidad: 1, espesor: 6, material: 'HDF 6mm',
      tapacanto: [], observaciones: '',
    },
    {
      _key: newKey(), etiqueta: 'Sop', nombre: 'Soporte', tipoPieza: 'soporte',
      largo: Math.round((ancho - 2 * ESPESOR) * 10) / 10,
      ancho: 10,
      cantidad: 2, espesor: 18, material: '',
      tapacanto: ['superior'], observaciones: '',
    },
  )

  // Puertas
  if ((tipo === 'Base con puertas' || tipo === 'Aéreo con puertas') && cantPuertas > 0) {
    const anchoPuerta = Math.round(((ancho - 0.3) / cantPuertas) * 10) / 10
    const altoPuerta = Math.round((alto - ESPESOR - 0.2) * 10) / 10
    piezas.push({
      _key: newKey(), etiqueta: 'Puerta', nombre: 'Puerta', tipoPieza: 'puerta',
      largo: altoPuerta, ancho: anchoPuerta,
      cantidad: cantPuertas, espesor: 18, material: '',
      tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'],
      observaciones: '',
    })
  }

  // Cajones
  if ((tipo === 'Base con cajones' || tipo === 'Base mixto') && cantCajones > 0) {
    const altoCajonFrente = Math.round(((alto - ESPESOR - cantCajones * 0.3) / cantCajones) * 10) / 10
    const anchoCajon = Math.round((ancho - 2 * ESPESOR - 0.3) * 10) / 10
    const anchoCajonInt = Math.round((ancho - 2 * ESPESOR - 3.4) * 10) / 10
    const altoCajonInt = Math.round((altoCajonFrente - 2) * 10) / 10
    const profFondo = Math.round((prof - 2) * 10) / 10

    piezas.push(
      {
        _key: newKey(), etiqueta: 'F-Caj', nombre: 'Frente de Cajón', tipoPieza: 'frente_cajon',
        largo: altoCajonFrente, ancho: anchoCajon,
        cantidad: cantCajones, espesor: 18, material: '',
        tapacanto: ['superior', 'inferior', 'izquierdo', 'derecho'],
        observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'T-Caj', nombre: 'Trasero de Cajón', tipoPieza: 'trasero_cajon',
        largo: altoCajonInt, ancho: anchoCajonInt,
        cantidad: cantCajones, espesor: 18, material: '',
        tapacanto: [], observaciones: '',
      },
      {
        _key: newKey(), etiqueta: 'Fd-Caj', nombre: 'Fondo de Cajón', tipoPieza: 'fondo_cajon',
        largo: profFondo, ancho: anchoCajonInt,
        cantidad: cantCajones, espesor: 6, material: 'HDF 6mm',
        tapacanto: [], observaciones: '',
      },
    )
  }

  return piezas
}

// ── Componente principal ─────────────────────────────────────────────────────

export function ModuloEditor({ modulo, proyectos, recursosDisponibles }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'datos' | 'despiece' | 'recursos' | 'resumen'>('despiece')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Datos generales
  const [proyectoId, setProyectoId] = useState(String(modulo.proyectoId || ''))
  const [codigo, setCodigo] = useState(modulo.codigo || '')
  const [tipoModulo, setTipoModulo] = useState(modulo.tipoModulo)
  const [nombre, setNombre] = useState(modulo.nombre)
  const [ancho, setAncho] = useState(String(modulo.ancho || ''))
  const [alto, setAlto] = useState(String(modulo.alto || ''))
  const [prof, setProf] = useState(String(modulo.profundidad || ''))
  const [cantPuertas, setCantPuertas] = useState(String(modulo.cantidadPuertas || 0))
  const [cantCajones, setCantCajones] = useState(String(modulo.cantidadCajones || 0))
  const [material, setMaterial] = useState(modulo.material)
  const [colorAcabado, setColorAcabado] = useState(modulo.colorAcabado || '')
  const [cantidad, setCantidad] = useState(String(modulo.cantidad || 1))
  const [precioVenta, setPrecioVenta] = useState(String(modulo.precioVenta || ''))
  const [estadoProduccion, setEstadoProduccion] = useState(modulo.estadoProduccion)
  const [observaciones, setObservaciones] = useState(modulo.observaciones || '')
  const [recursoTableroId, setRecursoTableroId] = useState(String(modulo.recursoTableroId || ''))
  const [anchoPlanchaCm, setAnchoPlanchaCm] = useState(String(modulo.anchoPlanchaCm || 244))
  const [largoPlanchaCm, setLargoPlanchaCm] = useState(String(modulo.largoPlanchaCm || 183))

  // Despiece
  const [piezas, setPiezas] = useState<PiezaLine[]>(
    modulo.piezas.map((p) => ({ ...p, _key: newKey(), tapacanto: Array.isArray(p.tapacanto) ? p.tapacanto : [] }))
  )

  // Recursos
  const [recursosModulo, setRecursosModulo] = useState<RecursoLine[]>(
    modulo.recursosModulo.map((r) => ({ ...r, _key: newKey(), recursoId: r.recursoId ?? null }))
  )

  // ── Cálculos derivados ───────────────────────────────────────────────────

  const totalAreaM2 = piezas.reduce((acc, p) => acc + calcAreaM2(p), 0)
  const totalTapacantoMl = piezas.reduce((acc, p) => acc + calcTapacantoMl(p), 0)
  const areaPlanchaM2 = (parseFloat(anchoPlanchaCm) * parseFloat(largoPlanchaCm)) / 10000 || 4.4652
  const numPlanchas = totalAreaM2 > 0 ? Math.ceil(totalAreaM2 / areaPlanchaM2) : 0
  const pctUsoPlancha = numPlanchas > 0 ? (totalAreaM2 / (numPlanchas * areaPlanchaM2)) * 100 : 0

  const tableroRecurso = recursosDisponibles.find((r) => r.id === parseInt(recursoTableroId))
  const costoTablero = numPlanchas * (tableroRecurso?.costoUnitario || 0)
  const totalRecursos = recursosModulo.reduce((acc, r) => acc + r.subtotal, 0)
  const costoTotal = costoTablero + totalRecursos
  const pv = parseFloat(precioVenta) || 0
  const margen = pv > 0 ? ((pv - costoTotal) / pv) * 100 : 0

  // Derivar costoMateriales/ManoObra/Instalacion para guardar
  const costoManoObraCalc = recursosModulo
    .filter((r) => {
      const rec = recursosDisponibles.find((x) => x.id === r.recursoId)
      return rec?.tipo === 'manoObra'
    })
    .reduce((acc, r) => acc + r.subtotal, 0)

  const costoInstalacionCalc = recursosModulo
    .filter((r) => {
      const rec = recursosDisponibles.find((x) => x.id === r.recursoId)
      return rec?.tipo === 'transportes'
    })
    .reduce((acc, r) => acc + r.subtotal, 0)

  // ── Handlers piezas ───────────────────────────────────────────────────────

  const addPieza = () => {
    setPiezas((prev) => [
      ...prev,
      {
        _key: newKey(), etiqueta: 'Lat', nombre: 'Lateral', tipoPieza: 'lateral',
        largo: 0, ancho: 0, cantidad: 1, espesor: 18, material: '',
        tapacanto: [], observaciones: '',
      },
    ])
  }

  const removePieza = (key: string) => setPiezas((prev) => prev.filter((p) => p._key !== key))

  const updatePieza = useCallback((key: string, field: keyof PiezaLine, value: unknown) => {
    setPiezas((prev) => prev.map((p) => {
      if (p._key !== key) return p
      if (field === 'etiqueta') {
        const et = ETIQUETAS_PIEZA.find((e) => e.value === value)
        const autoNombre: Record<string, string> = {
          Lat: 'Lateral', Piso: 'Piso', Fondo: 'Fondo', Sop: 'Soporte',
          Techo: 'Techo', Div: 'División', Repi: 'Repisa', Puerta: 'Puerta',
          'F-Caj': 'Frente de Cajón', 'T-Caj': 'Trasero de Cajón',
          'Fd-Caj': 'Fondo de Cajón', Otro: '',
        }
        return { ...p, etiqueta: value as string, nombre: autoNombre[value as string] ?? et?.label ?? '' }
      }
      return { ...p, [field]: value }
    }))
  }, [])

  const toggleTapacanto = (key: string, lado: string) => {
    setPiezas((prev) => prev.map((p) => {
      if (p._key !== key) return p
      const has = p.tapacanto.includes(lado)
      return {
        ...p,
        tapacanto: has ? p.tapacanto.filter((l) => l !== lado) : [...p.tapacanto, lado],
      }
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
    const generadas = generarDespiece(tipoModulo, a, h, p, cp, cc)
    setPiezas(generadas)
    setTab('despiece')
    setError(null)
  }

  // ── Handlers recursos ─────────────────────────────────────────────────────

  const addRecurso = () => {
    setRecursosModulo((prev) => [
      ...prev,
      { _key: newKey(), recursoId: null, descripcion: '', unidad: 'und', cantidad: 1, costoSnapshot: 0, subtotal: 0, observaciones: '' },
    ])
  }

  const removeRecurso = (key: string) => setRecursosModulo((prev) => prev.filter((r) => r._key !== key))

  const updateRecurso = (key: string, field: keyof RecursoLine, value: unknown) => {
    setRecursosModulo((prev) => prev.map((r) => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: value }
      if (field === 'recursoId') {
        const rec = recursosDisponibles.find((x) => x.id === Number(value))
        if (rec) {
          updated.descripcion = rec.nombre
          updated.unidad = rec.unidad
          updated.costoSnapshot = rec.costoUnitario
          updated.subtotal = r.cantidad * rec.costoUnitario
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

  // ── Guardar ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setLoading(true)
    setError(null)
    setSaved(false)

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
        material,
        colorAcabado: colorAcabado || null,
        cantidad: parseInt(cantidad) || 1,
        costoMateriales: costoTablero,
        costoManoObra: costoManoObraCalc,
        costoInstalacion: costoInstalacionCalc,
        precioVenta: parseFloat(precioVenta) || 0,
        estadoProduccion,
        observaciones: observaciones || null,
        recursoTableroId: recursoTableroId ? parseInt(recursoTableroId) : null,
        anchoPlanchaCm: parseFloat(anchoPlanchaCm) || 244,
        largoPlanchaCm: parseFloat(largoPlanchaCm) || 183,
        piezas: piezas.map(({ _key, id: _id, ...p }) => p),
        recursosModulo: recursosModulo.map(({ _key, id: _id, ...r }) => r),
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

  // ── UI ────────────────────────────────────────────────────────────────────

  const inputCls = 'w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50'

  return (
    <div className="space-y-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
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
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { key: 'datos', label: 'Datos', icon: <Settings2 className="w-3.5 h-3.5" /> },
          { key: 'despiece', label: 'Despiece', icon: <Layers className="w-3.5 h-3.5" /> },
          { key: 'recursos', label: 'Recursos', icon: <Package className="w-3.5 h-3.5" /> },
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

      {/* ── TAB: DATOS GENERALES ───────────────────────────────────────────── */}
      {tab === 'datos' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
              <input className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="B90-Fre" />
            </div>
            <div className="md:col-span-1">
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Ancho (cm)</label>
              <input type="number" className={inputCls} value={ancho} onChange={(e) => setAncho(e.target.value)} min="0" step="0.1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alto (cm)</label>
              <input type="number" className={inputCls} value={alto} onChange={(e) => setAlto(e.target.value)} min="0" step="0.1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prof. (cm)</label>
              <input type="number" className={inputCls} value={prof} onChange={(e) => setProf(e.target.value)} min="0" step="0.1" />
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Material principal</label>
              <input className={inputCls} value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Melamina Egger 18mm" />
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio de venta</label>
              <input type="number" className={inputCls} value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} min="0" step="1" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Proyecto</label>
              <select className={inputCls + ' bg-white'} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                <option value="">Sin proyecto</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
              <input className={inputCls} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del módulo" />
            </div>
          </div>

          {/* Plancha de referencia */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Plancha de referencia</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tablero (recurso)</label>
                <select className={inputCls + ' bg-white'} value={recursoTableroId} onChange={(e) => setRecursoTableroId(e.target.value)}>
                  <option value="">Sin vincular</option>
                  {recursosDisponibles
                    .filter((r) => r.tipo === 'materiales')
                    .map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ancho plancha (cm)</label>
                <input type="number" className={inputCls} value={anchoPlanchaCm} onChange={(e) => setAnchoPlanchaCm(e.target.value)} min="0" step="1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Largo plancha (cm)</label>
                <input type="number" className={inputCls} value={largoPlanchaCm} onChange={(e) => setLargoPlanchaCm(e.target.value)} min="0" step="1" />
              </div>
              <div className="flex items-end">
                <div className="bg-slate-50 rounded-md px-3 py-1.5 text-sm text-slate-600 border border-slate-200 w-full">
                  Área: <strong>{areaPlanchaM2.toFixed(4)} m²</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: DESPIECE ──────────────────────────────────────────────────── */}
      {tab === 'despiece' && (
        <div className="space-y-3">
          {/* Generar */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-800">Generación automática de despiece</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Basado en: {ancho || '?'}×{alto || '?'}×{prof || '?'} cm — {cantPuertas} puerta(s) — {cantCajones} cajón(es)
              </p>
            </div>
            <Button variant="secondary" onClick={handleGenerar}>
              <Wand2 className="w-4 h-4" />
              Generar despiece
            </Button>
          </div>

          {/* Tabla de piezas */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className={thCls} style={{ width: 110 }}>Etiqueta</th>
                    <th className={thCls}>Nombre</th>
                    <th className={thCls} style={{ width: 80 }}>Largo (cm)</th>
                    <th className={thCls} style={{ width: 80 }}>Ancho (cm)</th>
                    <th className={thCls} style={{ width: 60 }}>Cant.</th>
                    <th className={thCls} style={{ width: 70 }}>Esp. (mm)</th>
                    <th className={thCls} style={{ width: 80 }}>Material</th>
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
                    return (
                      <tr key={p._key} className="hover:bg-slate-50/50">
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
                            className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.largo}
                            onChange={(e) => updatePieza(p._key, 'largo', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.1"
                            className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          <input
                            className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={p.material}
                            onChange={(e) => updatePieza(p._key, 'material', e.target.value)}
                            placeholder="Mel 18mm"
                          />
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
                        <td className="px-2 py-1.5 text-right text-xs text-slate-600 font-mono">
                          {area.toFixed(4)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs text-amber-700 font-mono">
                          {tc.toFixed(2)}
                        </td>
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
                      <td className="px-2 py-2 text-right text-xs font-bold text-slate-800 font-mono">
                        {totalAreaM2.toFixed(4)} m²
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-amber-700 font-mono">
                        {totalTapacantoMl.toFixed(2)} ml
                      </td>
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Consumo de plancha</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Área total piezas</p>
                  <p className="text-lg font-bold text-slate-800">{totalAreaM2.toFixed(3)} m²</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Planchas necesarias</p>
                  <p className="text-lg font-bold text-blue-700">{numPlanchas}</p>
                  <p className="text-xs text-slate-400">({areaPlanchaM2.toFixed(3)} m² c/u)</p>
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
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RECURSOS ─────────────────────────────────────────────────── */}
      {tab === 'recursos' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={thCls}>Recurso del catálogo</th>
                  <th className={thCls} style={{ width: 80 }}>Unidad</th>
                  <th className={thCls} style={{ width: 80 }}>Cantidad</th>
                  <th className={thCls} style={{ width: 100 }}>Costo unit.</th>
                  <th className={thCls} style={{ width: 110 }}>Subtotal</th>
                  <th className={thCls}>Observaciones</th>
                  <th className={thCls} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recursosModulo.map((r) => (
                  <tr key={r._key} className="hover:bg-slate-50/50">
                    <td className="px-2 py-1.5">
                      <select
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.recursoId ?? ''}
                        onChange={(e) => updateRecurso(r._key, 'recursoId', e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="">— Seleccionar recurso —</option>
                        {recursosDisponibles.map((rec) => (
                          <option key={rec.id} value={rec.id}>
                            {rec.codigo ? `[${rec.codigo}] ` : ''}{rec.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.unidad}
                        onChange={(e) => updateRecurso(r._key, 'unidad', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.cantidad}
                        onChange={(e) => updateRecurso(r._key, 'cantidad', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.costoSnapshot}
                        onChange={(e) => updateRecurso(r._key, 'costoSnapshot', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-bold text-slate-800 pr-4 font-mono">
                      {formatCurrency(r.subtotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="border border-slate-200 rounded-md px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.observaciones}
                        onChange={(e) => updateRecurso(r._key, 'observaciones', e.target.value)}
                        placeholder="Nota..."
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeRecurso(r._key)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {recursosModulo.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                      No hay recursos agregados. Usa el botón para agregar desde el catálogo.
                    </td>
                  </tr>
                )}
              </tbody>
              {recursosModulo.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-slate-600">Total recursos</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-slate-800 pr-4 font-mono">
                      {formatCurrency(totalRecursos)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={addRecurso}>
              <Plus className="w-3.5 h-3.5" /> Agregar recurso
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: RESUMEN ──────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          {/* Tablero */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Consumo de melamina</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Piezas en despiece</p>
                <p className="text-2xl font-bold text-slate-800">{piezas.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Área total</p>
                <p className="text-2xl font-bold text-slate-800">{totalAreaM2.toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Planchas ({parseFloat(anchoPlanchaCm)/100}×{parseFloat(largoPlanchaCm)/100}m)</p>
                <p className="text-2xl font-bold text-blue-700">{numPlanchas}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tapacanto total</p>
                <p className="text-2xl font-bold text-amber-700">{totalTapacantoMl.toFixed(2)} ml</p>
              </div>
            </div>
            {tableroRecurso && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-600">Tablero: <strong>{tableroRecurso.nombre}</strong> — {numPlanchas} planchas × {formatCurrency(tableroRecurso.costoUnitario)}</span>
                <span className="font-bold text-slate-800">{formatCurrency(costoTablero)}</span>
              </div>
            )}
          </div>

          {/* Desglose de recursos */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recursos ({recursosModulo.length})</p>
            {recursosModulo.length === 0 ? (
              <p className="text-sm text-slate-400">Sin recursos agregados.</p>
            ) : (
              <div className="space-y-1.5">
                {recursosModulo.map((r) => {
                  const rec = recursosDisponibles.find((x) => x.id === r.recursoId)
                  return (
                    <div key={r._key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{rec?.nombre || r.descripcion || 'Recurso'} — {r.cantidad} {r.unidad}</span>
                      <span className="font-medium text-slate-800">{formatCurrency(r.subtotal)}</span>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between text-sm font-bold border-t border-slate-100 pt-1.5 mt-2">
                  <span className="text-slate-700">Total recursos</span>
                  <span className="text-slate-800">{formatCurrency(totalRecursos)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Resumen de costos */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Resumen de costos</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tablero</span>
                <span className="font-medium">{formatCurrency(costoTablero)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Recursos (herrajes, insumos, M.O.)</span>
                <span className="font-medium">{formatCurrency(totalRecursos)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                <span className="text-slate-800">Costo estimado total</span>
                <span className="text-slate-800">{formatCurrency(costoTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
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

      {/* Barra de resumen fija */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-20 shadow-lg">
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
