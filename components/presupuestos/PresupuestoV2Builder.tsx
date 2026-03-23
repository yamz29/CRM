'use client'

import { useState, useCallback, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Trash2, Copy, BarChart2, ChevronUp, ChevronDown,
  ChevronRight, Save, AlertCircle, CheckCircle, X,
  FileSpreadsheet, Layers, Percent, Tag,
} from 'lucide-react'
import { ApuSearchModal } from './ApuSearchModal'
import ImportarExcelModal, { ImportResult } from './ImportarExcelModal'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineaAPU {
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
}

export interface DetalleAPU {
  materiales: LineaAPU[]
  manoObra: LineaAPU[]
  equipos: LineaAPU[]
  subcontratos: LineaAPU[]
  transporte: LineaAPU[]
}

export interface Analisis {
  materiales: number; manoObra: number; equipos: number
  subcontratos: number; transporte: number; desperdicio: number
  indirectos: number; utilidad: number; costoDirecto: number
  costoTotal: number; precioSugerido: number; margen: number
  detalle?: DetalleAPU
}

interface Partida {
  id?: number
  codigo: string; descripcion: string; unidad: string
  cantidad: number; precioUnitario: number; subtotal: number
  observaciones: string; orden: number; analisis?: Analisis
}

interface Capitulo {
  id?: number
  codigo: string; nombre: string; orden: number
  tituloIdx: number | null   // null = floating (no title)
  partidas: Partida[]
}

export interface Titulo {
  id?: number
  nombre: string; orden: number; observaciones?: string
}

export interface IndirectoLinea {
  id?: number
  nombre: string; porcentaje: number; activo: boolean; orden: number
}

interface Props {
  clientes: { id: number; nombre: string }[]
  proyectos: { id: number; nombre: string; clienteId: number }[]
  unidadesGlobales?: string[]
  mode: 'create' | 'edit'
  initialData?: {
    id?: number
    clienteId?: number; proyectoId?: number | null
    estado?: string; notas?: string
    capitulos?: Capitulo[]
    titulos?: Titulo[]
    indirectoLineas?: IndirectoLinea[]
  }
  defaultClienteId?: number
  defaultProyectoId?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHAPTER_TEMPLATES = [
  { codigo: '01', nombre: 'Preliminares' },
  { codigo: '02', nombre: 'Demoliciones' },
  { codigo: '03', nombre: 'Albañilería' },
  { codigo: '04', nombre: 'Hormigón' },
  { codigo: '05', nombre: 'Eléctricas' },
  { codigo: '06', nombre: 'Sanitarias' },
  { codigo: '07', nombre: 'Terminaciones' },
  { codigo: '08', nombre: 'Pintura' },
  { codigo: '09', nombre: 'Melamina' },
  { codigo: '10', nombre: 'Limpieza' },
]

const TITLE_TEMPLATES = [
  'OBRAS PRELIMINARES', 'OBRA GRIS', 'TERMINACIONES',
  'MOBILIARIO Y MELAMINA', 'INSTALACIONES', 'FACHADA',
]

const DEFAULT_INDIRECTO_LINEAS: IndirectoLinea[] = [
  { nombre: 'Dirección técnica', porcentaje: 10, activo: true, orden: 0 },
  { nombre: 'Gastos administrativos', porcentaje: 5, activo: true, orden: 1 },
  { nombre: 'Transporte', porcentaje: 3, activo: true, orden: 2 },
  { nombre: 'Imprevistos', porcentaje: 2, activo: true, orden: 3 },
]

const UNIDADES = ['m2', 'ml', 'm3', 'gl', 'ud', 'kg', 'hr', 'm', 'ton', 'pl', 'jg', 'día', 'sem', 'mes', 'saco', 'lt', 'lts', 'PA']
const ESTADOS = ['Borrador', 'Enviado', 'Aprobado', 'Rechazado']
const TAB_FIELDS = ['codigo', 'descripcion', 'unidad', 'cantidad', 'precioUnitario'] as const
type TabField = (typeof TAB_FIELDS)[number]
type SeccionAPU = keyof DetalleAPU

const SECCIONES_APU: { key: SeccionAPU; label: string; color: string }[] = [
  { key: 'materiales',   label: 'Materiales',   color: 'bg-orange-50 border-orange-200' },
  { key: 'manoObra',     label: 'Mano de Obra',  color: 'bg-blue-50 border-blue-200' },
  { key: 'equipos',      label: 'Equipos',       color: 'bg-purple-50 border-purple-200' },
  { key: 'subcontratos', label: 'Subcontratos',  color: 'bg-pink-50 border-pink-200' },
  { key: 'transporte',   label: 'Transporte',    color: 'bg-teal-50 border-teal-200' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyLinea(): LineaAPU { return { descripcion: '', unidad: 'gl', cantidad: 1, precioUnitario: 0 } }
function emptyDetalle(): DetalleAPU { return { materiales: [emptyLinea()], manoObra: [], equipos: [], subcontratos: [], transporte: [] } }
function lineaSubtotal(l: LineaAPU) { return l.cantidad * l.precioUnitario }

function calcAnalisisFromDetalle(detalle: DetalleAPU, indirectos: number, utilidad: number): Analisis {
  const sumSec = (lines: LineaAPU[]) => lines.reduce((s, l) => s + lineaSubtotal(l), 0)
  const mat = sumSec(detalle.materiales), mo = sumSec(detalle.manoObra)
  const eq = sumSec(detalle.equipos), sub = sumSec(detalle.subcontratos), tra = sumSec(detalle.transporte)
  const costoDirecto = mat + mo + eq + sub + tra
  const costoConInd = costoDirecto * (1 + indirectos / 100)
  const precioSugerido = costoConInd * (1 + utilidad / 100)
  const margen = precioSugerido > 0 ? ((precioSugerido - costoDirecto) / precioSugerido) * 100 : 0
  return { materiales: mat, manoObra: mo, equipos: eq, subcontratos: sub, transporte: tra, desperdicio: 0, indirectos, utilidad, costoDirecto, costoTotal: costoConInd, precioSugerido, margen, detalle }
}

function emptyPartida(orden: number): Partida {
  return { codigo: '', descripcion: '', unidad: 'gl', cantidad: 1, precioUnitario: 0, subtotal: 0, observaciones: '', orden }
}
function emptyCapitulo(codigo: string, nombre: string, orden: number, tituloIdx: number | null = null): Capitulo {
  return { codigo, nombre, orden, tituloIdx, partidas: [emptyPartida(0)] }
}
function cellKey(ci: number, pi: number, field: string) { return `cell-${ci}-${pi}-${field}` }
function focusCell(ci: number, pi: number, field: string) {
  const el = document.querySelector<HTMLElement>(`[data-cellkey="${cellKey(ci, pi, field)}"]`)
  el?.focus()
}

// ── NumericCell ───────────────────────────────────────────────────────────────

function NumericCell({
  value, onChange, cellkey, onKeyDown, step = '0.0001', className = '',
}: {
  value: number; onChange: (v: number) => void
  cellkey: string; onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  step?: string; className?: string
}) {
  const [focused, setFocused] = useState(false)
  const displayValue = focused
    ? String(value === 0 ? '' : value)
    : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
  return (
    <input
      data-cellkey={cellkey}
      type={focused ? 'number' : 'text'}
      value={displayValue}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={(e) => { setFocused(true); setTimeout(() => e.target.select(), 0) }}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      step={step} min="0" placeholder="0"
      className={`w-full px-2 py-1.5 text-right text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-300 hover:border-slate-300 bg-transparent transition-colors ${className}`}
    />
  )
}

function NumericCellSimple({ value, onChange, step = '0.0001' }: { value: number; onChange: (v: number) => void; step?: string }) {
  const [focused, setFocused] = useState(false)
  const displayValue = focused
    ? String(value === 0 ? '' : value)
    : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
  return (
    <input
      type={focused ? 'number' : 'text'}
      value={displayValue}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={(e) => { setFocused(true); setTimeout(() => e.target.select(), 0) }}
      onBlur={() => setFocused(false)}
      step={step} min="0" placeholder="0"
      className="w-full px-2 py-1 text-right text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white hover:border-slate-300 bg-transparent transition-colors"
    />
  )
}

// ── APU helpers (unchanged) ───────────────────────────────────────────────────

function SeccionLineas({ seccion, lineas, onChange, unidades }: { seccion: { key: SeccionAPU; label: string; color: string }; lineas: LineaAPU[]; onChange: (lines: LineaAPU[]) => void; unidades: string[] }) {
  const total = lineas.reduce((s, l) => s + lineaSubtotal(l), 0)
  const addLinea = () => onChange([...lineas, emptyLinea()])
  const updateLinea = (i: number, field: keyof LineaAPU, val: string | number) => onChange(lineas.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  const removeLinea = (i: number) => onChange(lineas.filter((_, idx) => idx !== i))
  return (
    <div className={`rounded-lg border ${seccion.color} overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{seccion.label}</span>
        {total > 0 && <span className="text-xs font-semibold text-slate-700">{formatCurrency(total)}</span>}
      </div>
      {lineas.length > 0 && (
        <table className="w-full border-t border-slate-200/60">
          <thead><tr className="bg-white/60">
            <th className="px-2 py-1 text-left text-xs text-slate-400 font-medium w-6">#</th>
            <th className="px-2 py-1 text-left text-xs text-slate-500 font-semibold">Descripción</th>
            <th className="px-2 py-1 text-center text-xs text-slate-500 font-semibold w-20">Unidad</th>
            <th className="px-2 py-1 text-right text-xs text-slate-500 font-semibold w-20">Cantidad</th>
            <th className="px-2 py-1 text-right text-xs text-slate-500 font-semibold w-28">P. Unitario</th>
            <th className="px-2 py-1 text-right text-xs text-slate-500 font-semibold w-28">Subtotal</th>
            <th className="w-8" />
          </tr></thead>
          <tbody>
            {lineas.map((linea, i) => (
              <tr key={i} className="border-t border-slate-200/40 hover:bg-white/70 group">
                <td className="px-2 py-1 text-xs text-slate-400 text-center select-none">{i + 1}</td>
                <td className="px-1 py-0.5"><input type="text" value={linea.descripcion} onChange={(e) => updateLinea(i, 'descripcion', e.target.value)} placeholder="Descripción..." className="w-full px-2 py-1 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white hover:border-slate-300 bg-transparent transition-colors" /></td>
                <td className="px-1 py-0.5"><select value={linea.unidad} onChange={(e) => updateLinea(i, 'unidad', e.target.value)} className="w-full px-1 py-1 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white hover:border-slate-300 bg-transparent text-center transition-colors">{unidades.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                <td className="px-1 py-0.5"><NumericCellSimple value={linea.cantidad} onChange={(v) => updateLinea(i, 'cantidad', v)} step="0.0001" /></td>
                <td className="px-1 py-0.5"><NumericCellSimple value={linea.precioUnitario} onChange={(v) => updateLinea(i, 'precioUnitario', v)} /></td>
                <td className="px-2 py-1 text-right text-sm font-semibold text-slate-700 whitespace-nowrap">{lineaSubtotal(linea) > 0 ? formatCurrency(lineaSubtotal(linea)) : <span className="text-slate-300 font-normal">—</span>}</td>
                <td className="px-1 py-0.5"><button onClick={() => removeLinea(i)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="px-3 py-1.5 border-t border-slate-200/40">
        <button onClick={addLinea} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors"><Plus className="w-3 h-3" /> Agregar {seccion.label.toLowerCase()}</button>
      </div>
    </div>
  )
}

function ApuPanel({ partida, onClose, onUpdate, onApply, unidades }: { partida: Partida; onClose: () => void; onUpdate: (a: Analisis) => void; onApply: () => void; unidades: string[] }) {
  const analisis = partida.analisis
  const detalle: DetalleAPU = analisis?.detalle ?? emptyDetalle()
  const indirectos = analisis?.indirectos ?? 0
  const utilidad = analisis?.utilidad ?? 0
  const calc = calcAnalisisFromDetalle(detalle, indirectos, utilidad)
  const updateDetalle = useCallback((key: SeccionAPU, lines: LineaAPU[]) => { onUpdate(calcAnalisisFromDetalle({ ...detalle, [key]: lines }, indirectos, utilidad)) }, [detalle, indirectos, utilidad, onUpdate])
  const updatePct = useCallback((field: 'indirectos' | 'utilidad', val: number) => { onUpdate(calcAnalisisFromDetalle(detalle, field === 'indirectos' ? val : indirectos, field === 'utilidad' ? val : utilidad)) }, [detalle, indirectos, utilidad, onUpdate])
  return (
    <div className="bg-slate-50 border-y border-blue-200">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-blue-600" /><span className="text-sm font-bold text-slate-700">Análisis de Precio Unitario</span>{partida.descripcion && <span className="text-sm text-slate-400">— {partida.descripcion}</span>}</div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-6 py-4 space-y-3">
        {SECCIONES_APU.map((sec) => <SeccionLineas key={sec.key} seccion={sec} lineas={detalle[sec.key]} onChange={(lines) => updateDetalle(sec.key, lines)} unidades={unidades} />)}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Porcentajes</p>
            <div className="space-y-2">
              {(['indirectos', 'utilidad'] as const).map(field => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-slate-600 whitespace-nowrap">{field === 'indirectos' ? 'Gastos indirectos' : 'Utilidad'}</label>
                  <div className="flex items-center gap-1"><NumericCellSimple value={field === 'indirectos' ? indirectos : utilidad} onChange={(v) => updatePct(field, v)} step="0.5" /><span className="text-sm text-slate-500 flex-shrink-0">%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Resumen</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {SECCIONES_APU.filter(s => (calc[s.key as keyof Analisis] as number) > 0).map(s => (
                  <tr key={s.key}><td className="py-1 text-slate-500">{s.label}</td><td className="py-1 text-right font-medium text-slate-700">{formatCurrency(calc[s.key as keyof Analisis] as number)}</td></tr>
                ))}
                <tr className="border-t-2 border-slate-300"><td className="py-1.5 text-slate-600 font-semibold">Costo Directo</td><td className="py-1.5 text-right font-bold text-slate-800">{formatCurrency(calc.costoDirecto)}</td></tr>
                {indirectos > 0 && <tr><td className="py-1 text-slate-500">Indirectos ({indirectos}%)</td><td className="py-1 text-right text-slate-600">+{formatCurrency(calc.costoTotal - calc.costoDirecto)}</td></tr>}
                {utilidad > 0 && <tr><td className="py-1 text-slate-500">Utilidad ({utilidad}%)</td><td className="py-1 text-right text-slate-600">+{formatCurrency(calc.precioSugerido - calc.costoTotal)}</td></tr>}
                <tr className="bg-blue-50"><td className="py-2 px-1 font-bold text-blue-700 rounded-l">Precio sugerido</td><td className="py-2 px-1 text-right font-bold text-blue-700 text-base rounded-r">{formatCurrency(calc.precioSugerido)}</td></tr>
                <tr><td className="py-1 text-slate-500">Margen</td><td className="py-1 text-right font-semibold text-green-600">{calc.margen.toFixed(1)}%</td></tr>
              </tbody>
            </table>
            <button onClick={onApply} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"><CheckCircle className="w-4 h-4" />Aplicar {formatCurrency(calc.precioSugerido)} al presupuesto</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PresupuestoV2Builder({ clientes, proyectos, unidadesGlobales, mode, initialData, defaultClienteId, defaultProyectoId }: Props) {
  const UNIDADES_LIST = unidadesGlobales?.length ? unidadesGlobales : UNIDADES
  const router = useRouter()

  const [clienteId, setClienteId] = useState<string>(String(initialData?.clienteId || defaultClienteId || ''))
  const [proyectoId, setProyectoId] = useState<string>(String(initialData?.proyectoId || defaultProyectoId || ''))
  const [estado, setEstado] = useState(initialData?.estado || 'Borrador')
  const [notas, setNotas] = useState(initialData?.notas || '')
  const [titulos, setTitulos] = useState<Titulo[]>(initialData?.titulos || [])
  const [capitulos, setCapitulos] = useState<Capitulo[]>(initialData?.capitulos || [])
  const [indirectoLineas, setIndirectoLineas] = useState<IndirectoLinea[]>(
    initialData?.indirectoLineas && initialData.indirectoLineas.length > 0
      ? initialData.indirectoLineas
      : DEFAULT_INDIRECTO_LINEAS
  )
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [collapsedTitulos, setCollapsedTitulos] = useState<Set<number>>(new Set())
  const [showIndirecto, setShowIndirecto] = useState(true)
  const [apuOpen, setApuOpen] = useState<string | null>(null)
  const [apuSearchOpen, setApuSearchOpen] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  // ── Excel import handler ───────────────────────────────────────────────────

  const handleImport = useCallback((result: ImportResult) => {
    const newTitulos: Titulo[] = result.titulos.map(t => ({ nombre: t.nombre, orden: t.orden }))
    const newCapitulos: Capitulo[] = result.capitulos.map((cap, ci) => ({
      codigo: '',
      nombre: cap.nombre,
      orden: ci,
      tituloIdx: cap.tituloIdx,
      partidas: cap.partidas.map((p, pi) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        subtotal: p.subtotal,
        observaciones: p.observaciones,
        orden: pi,
      })),
    }))
    setTitulos(prev => [...prev, ...newTitulos])
    setCapitulos(prev => {
      const offset = prev.length
      return [
        ...prev,
        ...newCapitulos.map(cap => ({
          ...cap,
          orden: cap.orden + offset,
          tituloIdx: cap.tituloIdx != null ? cap.tituloIdx + titulos.length : null,
        })),
      ]
    })
    setShowImportModal(false)
  }, [titulos.length])

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredProyectos = clienteId ? proyectos.filter((p) => p.clienteId === parseInt(clienteId)) : proyectos
  const subtotalBase = capitulos.reduce((acc, cap) => acc + cap.partidas.reduce((a, p) => a + p.subtotal, 0), 0)
  const subtotalIndirecto = indirectoLineas.filter(l => l.activo).reduce((s, l) => s + subtotalBase * l.porcentaje / 100, 0)
  const grandTotal = subtotalBase + subtotalIndirecto

  // ── Titulo handlers ────────────────────────────────────────────────────────

  const addTitulo = useCallback((nombre = 'NUEVO TÍTULO') => {
    setTitulos(prev => [...prev, { nombre, orden: prev.length }])
  }, [])

  const updateTitulo = useCallback((ti: number, field: keyof Titulo, value: string) => {
    setTitulos(prev => prev.map((t, i) => i === ti ? { ...t, [field]: value } : t))
  }, [])

  const removeTitulo = useCallback((ti: number) => {
    // Unassign chapters from this titulo
    setCapitulos(prev => prev.map(c => c.tituloIdx === ti ? { ...c, tituloIdx: null } : c.tituloIdx !== null && c.tituloIdx > ti ? { ...c, tituloIdx: c.tituloIdx - 1 } : c))
    setTitulos(prev => prev.filter((_, i) => i !== ti))
  }, [])

  const toggleCollapsTitulo = useCallback((ti: number) => {
    setCollapsedTitulos(prev => { const n = new Set(prev); n.has(ti) ? n.delete(ti) : n.add(ti); return n })
  }, [])

  // ── Capitulo handlers ──────────────────────────────────────────────────────

  const addCapitulo = useCallback((tituloIdx: number | null = null) => {
    setCapitulos(prev => [...prev, emptyCapitulo('', 'Nuevo capítulo', prev.length, tituloIdx)])
  }, [])

  const addCapituloFromTemplate = useCallback((template: { codigo: string; nombre: string }, tituloIdx: number | null = null) => {
    setCapitulos(prev => [...prev, emptyCapitulo(template.codigo, template.nombre, prev.length, tituloIdx)])
  }, [])

  const updateCapitulo = useCallback((ci: number, field: 'codigo' | 'nombre' | 'tituloIdx', value: string | number | null) => {
    setCapitulos(prev => { const next = [...prev]; next[ci] = { ...next[ci], [field]: value }; return next })
  }, [])

  const removeCapitulo = useCallback((ci: number) => {
    setCapitulos(prev => prev.filter((_, i) => i !== ci))
  }, [])

  const moveCapitulo = useCallback((ci: number, dir: -1 | 1) => {
    setCapitulos(prev => {
      const next = [...prev]
      const target = ci + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[ci], next[target]] = [next[target], next[ci]]
      return next
    })
  }, [])

  const toggleCollapse = useCallback((ci: number) => {
    setCollapsed(prev => { const n = new Set(prev); n.has(ci) ? n.delete(ci) : n.add(ci); return n })
  }, [])

  // ── Partida handlers ───────────────────────────────────────────────────────

  const addPartida = useCallback((ci: number) => {
    setCapitulos(prev => {
      const next = [...prev]
      next[ci] = { ...next[ci], partidas: [...next[ci].partidas, emptyPartida(next[ci].partidas.length)] }
      return next
    })
  }, [])

  const updatePartida = useCallback((ci: number, pi: number, field: keyof Partida, value: string | number) => {
    setCapitulos(prev => {
      const next = [...prev]
      const partidas = [...next[ci].partidas]
      const p = { ...partidas[pi], [field]: value }
      if (field === 'cantidad' || field === 'precioUnitario') {
        p.subtotal = (field === 'cantidad' ? Number(value) : p.cantidad) * (field === 'precioUnitario' ? Number(value) : p.precioUnitario)
      }
      partidas[pi] = p
      next[ci] = { ...next[ci], partidas }
      return next
    })
  }, [])

  const removePartida = useCallback((ci: number, pi: number) => {
    setCapitulos(prev => { const next = [...prev]; next[ci] = { ...next[ci], partidas: next[ci].partidas.filter((_, i) => i !== pi) }; return next })
  }, [])

  const duplicatePartida = useCallback((ci: number, pi: number) => {
    setCapitulos(prev => {
      const next = [...prev]
      const partidas = [...next[ci].partidas]
      const copy = { ...partidas[pi], id: undefined, orden: partidas.length }
      partidas.splice(pi + 1, 0, copy)
      next[ci] = { ...next[ci], partidas }
      return next
    })
  }, [])

  // ── APU handlers ───────────────────────────────────────────────────────────

  const toggleApu = useCallback((key: string) => { setApuOpen(prev => prev === key ? null : key) }, [])
  const updateAnalisis = useCallback((ci: number, pi: number, analisis: Analisis) => {
    setCapitulos(prev => { const next = [...prev]; const partidas = [...next[ci].partidas]; partidas[pi] = { ...partidas[pi], analisis }; next[ci] = { ...next[ci], partidas }; return next })
  }, [])
  const applyPrecioSugerido = useCallback((ci: number, pi: number) => {
    setCapitulos(prev => {
      const next = [...prev]; const partidas = [...next[ci].partidas]; const p = { ...partidas[pi] }
      if (p.analisis) { p.precioUnitario = p.analisis.precioSugerido; p.subtotal = p.cantidad * p.precioUnitario }
      partidas[pi] = p; next[ci] = { ...next[ci], partidas }; return next
    })
    setApuOpen(null)
  }, [])
  const insertPartidaFromApu = useCallback((ci: number, partida: Partida) => {
    setCapitulos(prev => { const next = [...prev]; next[ci] = { ...next[ci], partidas: [...next[ci].partidas, { ...partida, orden: next[ci].partidas.length }] }; return next })
  }, [])

  // ── Indirecto handlers ─────────────────────────────────────────────────────

  const updateIndirectoLinea = useCallback((li: number, field: keyof IndirectoLinea, value: string | number | boolean) => {
    setIndirectoLineas(prev => prev.map((l, i) => i === li ? { ...l, [field]: value } : l))
  }, [])
  const addIndirectoLinea = useCallback(() => {
    setIndirectoLineas(prev => [...prev, { nombre: 'Nueva línea', porcentaje: 0, activo: true, orden: prev.length }])
  }, [])
  const removeIndirectoLinea = useCallback((li: number) => {
    setIndirectoLineas(prev => prev.filter((_, i) => i !== li))
  }, [])

  // ── Keyboard nav ───────────────────────────────────────────────────────────

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, ci: number, pi: number, fieldIdx: number) => {
    const cap = capitulos[ci]
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextIdx = e.shiftKey ? fieldIdx - 1 : fieldIdx + 1
      if (nextIdx >= 0 && nextIdx < TAB_FIELDS.length) { focusCell(ci, pi, TAB_FIELDS[nextIdx]) }
      else if (nextIdx >= TAB_FIELDS.length) {
        if (pi + 1 < cap.partidas.length) { focusCell(ci, pi + 1, TAB_FIELDS[0]) }
        else {
          setCapitulos(prev => { const next = [...prev]; next[ci] = { ...next[ci], partidas: [...next[ci].partidas, emptyPartida(next[ci].partidas.length)] }; return next })
          setTimeout(() => focusCell(ci, pi + 1, TAB_FIELDS[0]), 30)
        }
      } else { if (pi > 0) focusCell(ci, pi - 1, TAB_FIELDS[TAB_FIELDS.length - 1]) }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (pi + 1 < cap.partidas.length) { focusCell(ci, pi + 1, TAB_FIELDS[fieldIdx]) }
      else {
        setCapitulos(prev => { const next = [...prev]; next[ci] = { ...next[ci], partidas: [...next[ci].partidas, emptyPartida(next[ci].partidas.length)] }; return next })
        setTimeout(() => focusCell(ci, pi + 1, TAB_FIELDS[fieldIdx]), 30)
      }
    } else if (e.key === 'Escape') { (e.target as HTMLInputElement).blur() }
  }, [capitulos])

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setError(null)
    if (!clienteId) { setError('Selecciona un cliente antes de guardar.'); return }
    setLoading(true)
    try {
      const payload = { clienteId: parseInt(clienteId), proyectoId: proyectoId ? parseInt(proyectoId) : null, estado, notas, titulos, capitulos, indirectoLineas }
      const response = await fetch(
        mode === 'create' ? '/api/presupuestos-v2' : `/api/presupuestos-v2/${initialData?.id}`,
        { method: mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Error al guardar') }
      router.push(mode === 'create' ? '/presupuestos?msg=creado' : '/presupuestos?msg=actualizado')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar')
    } finally { setLoading(false) }
  }

  // ── Render capitulo (shared) ───────────────────────────────────────────────

  function renderCapitulo(cap: Capitulo, ci: number) {
    const capTotal = cap.partidas.reduce((a, p) => a + p.subtotal, 0)
    const isCollapsed = collapsed.has(ci)
    const pct = subtotalBase > 0 ? (capTotal / subtotalBase) * 100 : 0
    return (
      <div key={ci} className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {/* Chapter Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white select-none">
          <button onClick={() => toggleCollapse(ci)} className="p-0.5 rounded hover:bg-slate-700 transition-colors flex-shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
          </button>
          <input type="text" value={cap.codigo} onChange={(e) => updateCapitulo(ci, 'codigo', e.target.value)}
            placeholder="Cód." className="w-12 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 text-center" />
          <input type="text" value={cap.nombre} onChange={(e) => updateCapitulo(ci, 'nombre', e.target.value)}
            placeholder="Nombre del capítulo" className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-0" />

          {/* Assign to titulo dropdown */}
          {titulos.length > 0 && (
            <select
              value={cap.tituloIdx ?? ''}
              onChange={e => updateCapitulo(ci, 'tituloIdx', e.target.value === '' ? null : parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[140px]"
              title="Asignar a título"
            >
              <option value="">Sin título</option>
              {titulos.map((t, ti) => <option key={ti} value={ti}>{t.nombre}</option>)}
            </select>
          )}

          {capTotal > 0 && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-bold text-white">{formatCurrency(capTotal)}</div>
              {pct > 0 && <div className="text-xs text-slate-400">{pct.toFixed(1)}%</div>}
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => moveCapitulo(ci, -1)} disabled={ci === 0} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => moveCapitulo(ci, 1)} disabled={ci === capitulos.length - 1} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => setApuSearchOpen(ci)} className="p-1 rounded hover:bg-blue-700 transition-colors" title="Buscar en catálogo APU"><FileSpreadsheet className="w-3.5 h-3.5" /></button>
            <button onClick={() => removeCapitulo(ci)} className="p-1 rounded hover:bg-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Partidas */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-8">#</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-24">Código</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Descripción</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-20">Und</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-24">Cantidad</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-28">P. Unitario</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-28">Subtotal</th>
                  <th className="w-16" />
                </tr></thead>
                <tbody>
                  {cap.partidas.map((p, pi) => {
                    const apuKey = `${ci}-${pi}`
                    return (
                      <Fragment key={pi}>
                        <tr className="border-b border-slate-100 hover:bg-slate-50/50 group">
                          <td className="px-2 py-1 text-center text-xs text-slate-400 select-none">{pi + 1}</td>
                          <td className="px-1 py-0.5">
                            <NumericCell value={0} onChange={() => {}} cellkey={cellKey(ci, pi, 'codigo')} onKeyDown={(e) => handleCellKeyDown(e, ci, pi, 0)}
                              step="1" className="hidden" />
                            <input type="text" value={p.codigo} onChange={(e) => updatePartida(ci, pi, 'codigo', e.target.value)}
                              data-cellkey={cellKey(ci, pi, 'codigo')}
                              onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); focusCell(ci, pi, TAB_FIELDS[1]) } }}
                              placeholder="APU-001" className="w-full px-2 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-300 hover:border-slate-300 bg-transparent transition-colors" />
                          </td>
                          <td className="px-1 py-0.5">
                            <input type="text" value={p.descripcion} onChange={(e) => updatePartida(ci, pi, 'descripcion', e.target.value)}
                              data-cellkey={cellKey(ci, pi, 'descripcion')}
                              onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); focusCell(ci, pi, TAB_FIELDS[2]) } }}
                              placeholder="Descripción de la partida..." className="w-full px-2 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-300 hover:border-slate-300 bg-transparent transition-colors" />
                          </td>
                          <td className="px-1 py-0.5">
                            <select value={p.unidad} onChange={(e) => updatePartida(ci, pi, 'unidad', e.target.value)}
                              data-cellkey={cellKey(ci, pi, 'unidad')}
                              className="w-full px-1 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-white hover:border-slate-300 bg-transparent text-center transition-colors">
                              {UNIDADES_LIST.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-0.5">
                            <NumericCell value={p.cantidad} onChange={(v) => updatePartida(ci, pi, 'cantidad', v)}
                              cellkey={cellKey(ci, pi, 'cantidad')} onKeyDown={(e) => handleCellKeyDown(e, ci, pi, 3)} step="0.0001" />
                          </td>
                          <td className="px-1 py-0.5">
                            <NumericCell value={p.precioUnitario} onChange={(v) => updatePartida(ci, pi, 'precioUnitario', v)}
                              cellkey={cellKey(ci, pi, 'precioUnitario')} onKeyDown={(e) => handleCellKeyDown(e, ci, pi, 4)} step="0.0001" />
                          </td>
                          <td className="px-2 py-1 text-right text-sm font-bold text-slate-800 whitespace-nowrap">
                            {p.subtotal > 0 ? formatCurrency(p.subtotal) : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="px-1 py-0.5">
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => toggleApu(apuKey)} title="APU" className={`p-1 rounded transition-colors ${apuOpen === apuKey ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'}`}><BarChart2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => duplicatePartida(ci, pi)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removePartida(ci, pi)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                        {apuOpen === apuKey && (
                          <tr><td colSpan={8} className="p-0">
                            <ApuPanel partida={p} onClose={() => setApuOpen(null)} onUpdate={(a) => updateAnalisis(ci, pi, a)} onApply={() => applyPrecioSugerido(ci, pi)} unidades={UNIDADES_LIST} />
                          </td></tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={6} className="px-3 py-2 text-xs text-slate-500 text-right">Subtotal {cap.nombre}</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-slate-800">{formatCurrency(capTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Add partida / APU search */}
            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-t border-slate-100">
              <button onClick={() => addPartida(ci)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar partida
              </button>
              <button onClick={() => setApuSearchOpen(ci)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Insertar desde catálogo APU
              </button>
            </div>

            {apuSearchOpen === ci && (
              <ApuSearchModal
                onClose={() => setApuSearchOpen(null)}
                onInsert={(partida) => { insertPartidaFromApu(ci, partida); setApuSearchOpen(null) }}
                currentOrden={capitulos[ci].partidas.length}
              />
            )}
          </>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Group: titulos in order, then floating chapters
  const chaptersByTitulo: Record<number, { cap: Capitulo; ci: number }[]> = {}
  const floatingChapters: { cap: Capitulo; ci: number }[] = []
  capitulos.forEach((cap, ci) => {
    if (cap.tituloIdx !== null && titulos[cap.tituloIdx]) {
      if (!chaptersByTitulo[cap.tituloIdx]) chaptersByTitulo[cap.tituloIdx] = []
      chaptersByTitulo[cap.tituloIdx].push({ cap, ci })
    } else {
      floatingChapters.push({ cap, ci })
    }
  })

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" /><span className="font-medium">{error}</span></div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 ml-4"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cliente <span className="text-red-500">*</span></label>
              <select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setProyectoId('') }} className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Proyecto</label>
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} disabled={!clienteId} className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
                <option value="">Sin proyecto</option>
                {filteredProyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notas / Observaciones</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Condiciones del presupuesto, alcances, notas para el cliente..."
              rows={3}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-3">
        {/* Add Titulo */}
        <div className="flex items-center gap-1.5 mr-2">
          <Layers className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">+ Título:</span>
        </div>
        <button onClick={() => addTitulo()} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors"><Plus className="w-3 h-3" /> Vacío</button>
        {TITLE_TEMPLATES.map(t => (
          <button key={t} onClick={() => addTitulo(t)} className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors truncate max-w-[140px]">{t}</button>
        ))}

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Add Capitulo */}
        <div className="flex items-center gap-1.5 mr-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">+ Cap:</span>
        </div>
        <button onClick={() => addCapitulo(null)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"><Plus className="w-3 h-3" /> Vacío</button>
        {CHAPTER_TEMPLATES.map(t => (
          <button key={t.codigo} onClick={() => addCapituloFromTemplate(t, null)} className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors">{t.codigo}·{t.nombre}</button>
        ))}

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* Import from Excel */}
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Importar Excel
        </button>
      </div>

      {/* Keyboard hint */}
      {capitulos.length > 0 && (
        <p className="text-xs text-slate-400 px-1">
          Navega con <kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono">Tab</kbd> · <kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs font-mono">Enter</kbd> siguiente fila · Cantidades admiten hasta 4 decimales (ej: 0.0025)
        </p>
      )}

      {/* Empty state */}
      {capitulos.length === 0 && titulos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3"><Plus className="w-7 h-7 text-slate-400" /></div>
          <p className="text-lg font-semibold text-slate-500 mb-1">Agrega tu primer título o capítulo</p>
          <p className="text-sm text-slate-400 mb-5">Usa la barra de arriba para agregar títulos (grupos) y capítulos</p>
        </div>
      )}

      {/* ── TÍTULOS con sus capítulos ── */}
      {titulos.map((titulo, ti) => {
        const capsInTitulo = chaptersByTitulo[ti] || []
        const tituloTotal = capsInTitulo.reduce((s, { cap }) => s + cap.partidas.reduce((a, p) => a + p.subtotal, 0), 0)
        const isCollapsedT = collapsedTitulos.has(ti)
        return (
          <div key={ti} className="border-2 border-amber-200 rounded-xl overflow-hidden">
            {/* Titulo header */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
              <button onClick={() => toggleCollapsTitulo(ti)} className="p-0.5 rounded hover:bg-amber-100 transition-colors flex-shrink-0">
                <ChevronRight className={`w-4 h-4 text-amber-700 transition-transform ${isCollapsedT ? '' : 'rotate-90'}`} />
              </button>
              <Tag className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <input type="text" value={titulo.nombre}
                onChange={e => updateTitulo(ti, 'nombre', e.target.value)}
                className="flex-1 bg-transparent text-sm font-bold text-amber-800 placeholder-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 rounded px-1 uppercase tracking-wide min-w-0" />
              {tituloTotal > 0 && <span className="text-sm font-bold text-amber-700 flex-shrink-0">{formatCurrency(tituloTotal)}</span>}
              <button onClick={() => addCapitulo(ti)} className="flex items-center gap-1 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 rounded border border-amber-300 transition-colors flex-shrink-0">
                <Plus className="w-3 h-3" /> Cap.
              </button>
              <button onClick={() => removeTitulo(ti)} className="p-1 rounded hover:bg-red-100 text-amber-400 hover:text-red-600 transition-colors flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            {/* Chapters within this titulo */}
            {!isCollapsedT && (
              <div className="p-3 space-y-3 bg-amber-50/30">
                {capsInTitulo.length === 0 ? (
                  <div className="text-center py-4 text-xs text-amber-500 border border-dashed border-amber-200 rounded-lg">
                    Sin capítulos. Usa "+ Cap." para agregar uno aquí, o asigna un capítulo existente a este título.
                  </div>
                ) : (
                  capsInTitulo.map(({ cap, ci }) => renderCapitulo(cap, ci))
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Capítulos flotantes (sin título) ── */}
      {floatingChapters.length > 0 && (
        <div className="space-y-3">
          {titulos.length > 0 && (
            <p className="text-xs text-slate-400 font-medium px-1">Capítulos sin título asignado:</p>
          )}
          {floatingChapters.map(({ cap, ci }) => renderCapitulo(cap, ci))}
        </div>
      )}

      {/* ══ GASTOS INDIRECTOS ══ */}
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-700 text-white">
          <button onClick={() => setShowIndirecto(p => !p)} className="p-0.5 rounded hover:bg-slate-600 transition-colors flex-shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform ${showIndirecto ? 'rotate-90' : ''}`} />
          </button>
          <Percent className="w-4 h-4 text-slate-300 flex-shrink-0" />
          <span className="flex-1 text-sm font-bold uppercase tracking-wide">Gastos Indirectos</span>
          <div className="text-right text-sm flex-shrink-0">
            <span className="text-slate-400 text-xs mr-2">Base: {formatCurrency(subtotalBase)}</span>
            <span className="font-bold">{formatCurrency(subtotalIndirecto)}</span>
          </div>
        </div>

        {showIndirecto && (
          <div className="bg-slate-50 p-4 space-y-3">
            <p className="text-xs text-slate-500">
              Cada línea se calcula automáticamente sobre el subtotal de las partidas normales ({formatCurrency(subtotalBase)}).
            </p>
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase">Concepto</th>
                <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase w-24">% sobre base</th>
                <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase w-32">Monto calculado</th>
                <th className="pb-2 w-16" />
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {indirectoLineas.map((linea, li) => {
                  const monto = subtotalBase * linea.porcentaje / 100
                  return (
                    <tr key={li} className={`${linea.activo ? '' : 'opacity-40'}`}>
                      <td className="py-2 pr-3">
                        <input type="text" value={linea.nombre} onChange={e => updateIndirectoLinea(li, 'nombre', e.target.value)}
                          className="w-full text-sm text-slate-700 bg-transparent border border-transparent rounded px-2 py-0.5 focus:outline-none focus:border-slate-300 focus:bg-white hover:border-slate-200" />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" value={linea.porcentaje} step="0.5" min="0" max="100"
                            onChange={e => updateIndirectoLinea(li, 'porcentaje', parseFloat(e.target.value) || 0)}
                            className="w-16 text-right text-sm text-slate-700 bg-white border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:border-blue-400" />
                          <span className="text-sm text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(monto)}</td>
                      <td className="py-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => updateIndirectoLinea(li, 'activo', !linea.activo)} className={`p-1 rounded transition-colors ${linea.activo ? 'text-green-500 hover:bg-green-50' : 'text-slate-300 hover:bg-slate-100'}`} title={linea.activo ? 'Desactivar' : 'Activar'}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeIndirectoLinea(li)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={2} className="pt-3 text-sm font-bold text-slate-700 text-right pr-3">Total Gastos Indirectos</td>
                  <td className="pt-3 text-right text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(subtotalIndirecto)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <button onClick={addIndirectoLinea} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>
        )}
      </div>

      {/* ── Grand Total + Save ── */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Subtotal Partidas</p>
              <p className="text-lg font-bold text-slate-700">{formatCurrency(subtotalBase)}</p>
            </div>
            {subtotalIndirecto > 0 && (
              <>
                <div className="text-slate-300">+</div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Gastos Indirectos</p>
                  <p className="text-lg font-bold text-slate-700">{formatCurrency(subtotalIndirecto)}</p>
                </div>
                <div className="text-slate-300">=</div>
              </>
            )}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total General</p>
              <p className="text-2xl font-black text-slate-900">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} size="lg" className="gap-2">
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : mode === 'create' ? 'Crear cotización' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {showImportModal && (
        <ImportarExcelModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}
    </div>
  )
}
