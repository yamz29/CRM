'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Plus, Save, AlertCircle, X, PackagePlus, PenLine, BookOpen, Search } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecursoRef {
  id: number
  codigo?: string | null
  nombre: string
  tipo: string
  unidad: string
  costoUnitario: number
}

interface ApuRef {
  id: number
  codigo?: string | null
  nombre: string
  unidad: string
  precioVenta: number
  capitulo?: string | null
}

interface RecursoLine {
  recursoId: number | null
  isLibre?: boolean
  descripcionLibre?: string
  unidadLibre?: string
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
}

interface ApuLine {
  apuHijoId: number
  nombreSnapshot: string
  unidadSnapshot: string
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
}

type TipoSeccion = 'materiales' | 'manoObra' | 'equipos' | 'subcontratos' | 'transportes'

interface Props {
  recursos: RecursoRef[]
  apusDisponibles: ApuRef[]
  mode: 'create' | 'edit'
  initialData?: {
    id?: number
    codigo?: string
    nombre?: string
    descripcion?: string
    capitulo?: string
    unidad?: string
    indirectos?: number
    utilidad?: number
    desperdicio?: number
    activo?: boolean
    observaciones?: string
    recursos?: Array<{
      tipoComponente?: string | null
      recursoId?: number | null
      apuHijoId?: number | null
      nombreSnapshot?: string | null
      unidadSnapshot?: string | null
      descripcionLibre?: string | null
      unidadLibre?: string | null
      tipoLinea?: string | null
      cantidad: number
      costoSnapshot: number
      subtotal: number
      observaciones?: string | null
      recurso?: RecursoRef | null
      apuHijo?: ApuRef | null
    }>
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECCIONES: Array<{ key: TipoSeccion; label: string; tipos: string[]; color: string; headerColor: string }> = [
  { key: 'materiales',   label: 'Materiales',   tipos: ['materiales', 'herrajes', 'consumibles'], color: 'bg-orange-50 border-orange-200', headerColor: 'bg-orange-100 text-orange-800' },
  { key: 'manoObra',     label: 'Mano de Obra',  tipos: ['manoObra'],     color: 'bg-blue-50 border-blue-200', headerColor: 'bg-blue-100 text-blue-800' },
  { key: 'equipos',      label: 'Equipos y Herramientas', tipos: ['equipos', 'herramientas'], color: 'bg-purple-50 border-purple-200', headerColor: 'bg-purple-100 text-purple-800' },
  { key: 'subcontratos', label: 'Subcontratos',  tipos: ['subcontratos'], color: 'bg-pink-50 border-pink-200', headerColor: 'bg-pink-100 text-pink-800' },
  { key: 'transportes',  label: 'Transporte',    tipos: ['transportes'],  color: 'bg-teal-50 border-teal-200', headerColor: 'bg-teal-100 text-teal-800' },
]

const UNIDADES = ['gl', 'ud', 'PA', 'm2', 'ml', 'm3', 'm', 'kg', 'ton', 'lt', 'saco', 'pl', 'par', 'hr', 'día', 'sem', 'mes', 'viaje', 'jg']

const CAPITULOS = ['Preliminares', 'Demoliciones', 'Albañilería', 'Hormigón', 'Eléctricas', 'Sanitarias', 'Terminaciones', 'Pintura', 'Melamina', 'Limpieza', 'General']

// ── Helper ────────────────────────────────────────────────────────────────────

function buildInitialSections(
  apuRecursos: NonNullable<Props['initialData']>['recursos'],
  secciones: typeof SECCIONES
): Record<TipoSeccion, RecursoLine[]> {
  const result: Record<TipoSeccion, RecursoLine[]> = {
    materiales: [], manoObra: [], equipos: [], subcontratos: [], transportes: []
  }
  if (!apuRecursos) return result

  for (const ar of apuRecursos) {
    if (ar.tipoComponente === 'apu') continue  // handled separately
    if (ar.recursoId && ar.recurso) {
      const sec = secciones.find((s) => s.tipos.includes(ar.recurso!.tipo))
      if (sec) {
        result[sec.key].push({
          recursoId: ar.recursoId,
          isLibre: false,
          cantidad: ar.cantidad,
          costoSnapshot: ar.costoSnapshot,
          subtotal: ar.subtotal,
          observaciones: ar.observaciones || '',
        })
      }
    } else if (ar.descripcionLibre) {
      const sec = secciones.find((s) => s.key === ar.tipoLinea) ?? secciones[0]
      result[sec.key].push({
        recursoId: null,
        isLibre: true,
        descripcionLibre: ar.descripcionLibre,
        unidadLibre: ar.unidadLibre || 'ud',
        cantidad: ar.cantidad,
        costoSnapshot: ar.costoSnapshot,
        subtotal: ar.subtotal,
        observaciones: ar.observaciones || '',
      })
    }
  }
  return result
}

function buildInitialApuLines(
  apuRecursos: NonNullable<Props['initialData']>['recursos']
): ApuLine[] {
  if (!apuRecursos) return []
  return apuRecursos
    .filter((ar) => ar.tipoComponente === 'apu' && ar.apuHijoId)
    .map((ar) => ({
      apuHijoId: ar.apuHijoId!,
      nombreSnapshot: ar.nombreSnapshot || ar.apuHijo?.nombre || '',
      unidadSnapshot: ar.unidadSnapshot || ar.apuHijo?.unidad || 'gl',
      cantidad: ar.cantidad,
      costoSnapshot: ar.costoSnapshot,
      subtotal: ar.subtotal,
      observaciones: ar.observaciones || '',
    }))
}

// ── FormulaInput ──────────────────────────────────────────────────────────────

function evalFormula(expr: string): number | null {
  const clean = expr.trim()
  if (!clean) return null
  // Only allow digits, decimal points, operators, parentheses and spaces
  if (!/^[\d\s+\-*/.()]+$/.test(clean)) return null
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + clean)() as unknown
    if (typeof result !== 'number' || !isFinite(result)) return null
    return Math.round(result * 1_000_000) / 1_000_000
  } catch {
    return null
  }
}

function NumericInput({ value, onChange, step = '1', placeholder = '0', className = '' }: {
  value: number; onChange: (v: number) => void; step?: string; placeholder?: string; className?: string
}) {
  const [raw, setRaw] = useState('')
  const [focused, setFocused] = useState(false)
  const [formulaErr, setFormulaErr] = useState(false)

  const display = focused
    ? raw
    : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    setFormulaErr(false)
    setRaw(value === 0 ? '' : String(value))
    setTimeout(() => e.target.select(), 0)
  }

  const handleBlur = () => {
    setFocused(false)
    if (!raw.trim()) { onChange(0); setFormulaErr(false); return }
    // Try formula first, then plain number
    const formulaResult = evalFormula(raw)
    if (formulaResult !== null) {
      onChange(formulaResult)
      setFormulaErr(false)
    } else {
      const plain = parseFloat(raw)
      if (!isNaN(plain)) { onChange(plain); setFormulaErr(false) }
      else setFormulaErr(true)
    }
  }

  const borderClass = formulaErr
    ? 'border-red-400 bg-red-50 focus:ring-red-400'
    : 'border-slate-300 bg-white focus:ring-blue-500'

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => { setRaw(e.target.value); setFormulaErr(false) }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={focused ? 'ej: 4*2.5' : placeholder}
      title={formulaErr ? 'Fórmula inválida. Ej: 4*2.5, 100/4, 3+1.5' : 'Soporta fórmulas: +  −  *  /  ( )'}
      className={`w-full px-2 py-1.5 text-sm text-right border rounded focus:outline-none focus:ring-2 ${borderClass} ${className}`}
    />
  )
}

// ── NuevoRecursoModal ─────────────────────────────────────────────────────────

function NuevoRecursoModal({ tipoDefault, onCreated, onClose }: {
  tipoDefault: string
  onCreated: (recurso: RecursoRef) => void
  onClose: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState(tipoDefault)
  const [unidad, setUnidad] = useState('ud')
  const [costo, setCosto] = useState(0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSave = async () => {
    if (!nombre.trim()) { setErr('El nombre es obligatorio'); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch('/api/recursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, tipo, unidad, costoUnitario: costo, activo: true }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const created = await res.json()
      onCreated(created)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al crear')
      setSaving(false)
    }
  }

  const TIPOS_RECURSO = ['materiales', 'herrajes', 'consumibles', 'manoObra', 'equipos', 'herramientas', 'subcontratos', 'transportes']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-blue-600" />
            Nuevo Recurso
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
              placeholder="Ej: Block de hormigón 6&quot;"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIPOS_RECURSO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unidad</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Costo Unitario (RD$)</label>
            <NumericInput value={costo} onChange={setCosto} step="0.01" placeholder="0.00" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2">
            {saving ? 'Creando...' : <><Plus className="w-3.5 h-3.5" />Crear y agregar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RecursoSearch ─────────────────────────────────────────────────────────────

function RecursoSearch({ recursos, selectedId, onSelect }: {
  recursos: RecursoRef[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const selected = selectedId ? recursos.find((r) => r.id === selectedId) : null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = query.length < 1
    ? recursos.slice(0, 40)
    : recursos.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.nombre.toLowerCase().includes(q) ||
          (r.codigo?.toLowerCase().includes(q) ?? false) ||
          r.tipo.toLowerCase().includes(q) ||
          r.unidad.toLowerCase().includes(q)
        )
      }).slice(0, 40)

  const handleSelect = (r: RecursoRef) => {
    onSelect(r.id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {open ? (
        <div className="flex flex-col gap-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, código, tipo..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="absolute top-9 left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 italic">Sin resultados para &quot;{query}&quot;</p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={() => handleSelect(r)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-700 truncate block">
                        {r.codigo && <span className="font-mono text-slate-400 mr-1">[{r.codigo}]</span>}
                        {r.nombre}
                      </span>
                      <span className="text-xs text-slate-400">{r.tipo} · {r.unidad}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap flex-shrink-0">
                      {formatCurrency(r.costoUnitario)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none hover:border-blue-400 bg-white transition-colors flex items-center justify-between gap-2"
        >
          {selected ? (
            <span className="truncate text-slate-700">
              {selected.codigo && <span className="font-mono text-slate-400 mr-1 text-xs">[{selected.codigo}]</span>}
              {selected.nombre}
            </span>
          ) : (
            <span className="text-slate-400">— Buscar recurso —</span>
          )}
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </button>
      )}
    </div>
  )
}

// ── ApuSearch ─────────────────────────────────────────────────────────────────

function ApuSearch({ apus, onSelect }: {
  apus: ApuRef[]
  onSelect: (apu: ApuRef) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = apus.filter((a) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      a.nombre.toLowerCase().includes(q) ||
      (a.codigo?.toLowerCase().includes(q) ?? false) ||
      (a.capitulo?.toLowerCase().includes(q) ?? false)
    )
  }).slice(0, 50)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        Agregar APU existente
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar APU por nombre, código o capítulo..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>
      <div className="absolute top-10 left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400 italic">Sin resultados para &quot;{query}&quot;</p>
        ) : (
          filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => { onSelect(a); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-slate-100 last:border-0 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-700 truncate">
                    {a.codigo && <span className="font-mono text-slate-400 mr-1">[{a.codigo}]</span>}
                    {a.nombre}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {a.capitulo && <span className="mr-2">{a.capitulo}</span>}
                    <span>{a.unidad}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold text-indigo-700">{formatCurrency(a.precioVenta)}</div>
                  <div className="text-xs text-slate-400">/{a.unidad}</div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Section Component ─────────────────────────────────────────────────────────

function SeccionRecursos({
  seccion,
  lines,
  recursosDisponibles,
  onChange,
  onNuevoRecurso,
}: {
  seccion: typeof SECCIONES[number]
  lines: RecursoLine[]
  recursosDisponibles: RecursoRef[]
  onChange: (lines: RecursoLine[]) => void
  onNuevoRecurso: (tipoDefault: string, onCreated: (r: RecursoRef) => void) => void
}) {
  const total = lines.reduce((s, l) => s + l.subtotal, 0)
  const recursos = recursosDisponibles.filter((r) => seccion.tipos.includes(r.tipo))

  const addLine = () =>
    onChange([...lines, { recursoId: null, isLibre: false, cantidad: 1, costoSnapshot: 0, subtotal: 0, observaciones: '' }])

  const addLineLibre = () =>
    onChange([...lines, { recursoId: null, isLibre: true, descripcionLibre: '', unidadLibre: 'ud', cantidad: 1, costoSnapshot: 0, subtotal: 0, observaciones: '' }])

  const updateLine = (i: number, updates: Partial<RecursoLine>) => {
    onChange(
      lines.map((l, idx) => {
        if (idx !== i) return l
        const updated = { ...l, ...updates }
        updated.subtotal = updated.cantidad * updated.costoSnapshot
        return updated
      })
    )
  }

  const selectRecurso = (i: number, recursoId: number) => {
    const r = recursosDisponibles.find((x) => x.id === recursoId)
    if (!r) return
    updateLine(i, { recursoId, costoSnapshot: r.costoUnitario })
  }

  const toggleLibre = (i: number) => {
    const line = lines[i]
    if (line.isLibre) {
      // switch to catálogo
      updateLine(i, { isLibre: false, recursoId: null, descripcionLibre: '', unidadLibre: '', costoSnapshot: 0 })
    } else {
      // switch to libre
      updateLine(i, { isLibre: true, recursoId: null, descripcionLibre: '', unidadLibre: 'ud', costoSnapshot: 0 })
    }
  }

  const removeLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i))

  return (
    <div className={`rounded-lg border ${seccion.color} overflow-hidden`}>
      {/* Section header */}
      <div className={`flex items-center justify-between px-4 py-2 ${seccion.headerColor}`}>
        <span className="text-xs font-bold uppercase tracking-wide">{seccion.label}</span>
        <div className="flex items-center gap-3">
          {total > 0 && <span className="text-xs font-semibold">{formatCurrency(total)}</span>}
          <span className="text-xs opacity-60">{lines.length} línea{lines.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Lines */}
      {lines.length > 0 && (
        <table className="w-full border-t border-white/50">
          <thead>
            <tr className="bg-white/40 text-xs text-slate-500">
              <th className="px-2 py-1.5 text-left font-semibold w-6">#</th>
              <th className="px-2 py-1.5 w-7" title="Alternar entre catálogo y texto libre" />
              <th className="px-3 py-1.5 text-left font-semibold">Recurso / Descripción</th>
              <th className="px-3 py-1.5 text-center font-semibold w-16">Unidad</th>
              <th className="px-3 py-1.5 text-right font-semibold w-24">Cantidad</th>
              <th className="px-3 py-1.5 text-right font-semibold w-32">Costo Unit.</th>
              <th className="px-3 py-1.5 text-right font-semibold w-32 bg-white/40">Subtotal</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const selectedRecurso = !line.isLibre && line.recursoId
                ? recursosDisponibles.find((r) => r.id === line.recursoId)
                : null
              return (
                <tr key={i} className="border-t border-white/40 hover:bg-white/60 group transition-colors">
                  <td className="px-2 py-1.5 text-xs text-slate-400 select-none">{i + 1}</td>
                  {/* Toggle catálogo / libre */}
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => toggleLibre(i)}
                      title={line.isLibre ? 'Usar recurso del catálogo' : 'Escribir texto libre'}
                      className={`p-1 rounded transition-colors ${line.isLibre ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'}`}
                    >
                      {line.isLibre ? <PenLine className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    {line.isLibre ? (
                      <input
                        type="text"
                        value={line.descripcionLibre ?? ''}
                        onChange={(e) => updateLine(i, { descripcionLibre: e.target.value })}
                        placeholder="Descripción libre..."
                        className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                      />
                    ) : (
                      <RecursoSearch
                        recursos={recursos}
                        selectedId={line.recursoId}
                        onSelect={(id) => selectRecurso(i, id)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {line.isLibre ? (
                      <select
                        value={line.unidadLibre ?? 'ud'}
                        onChange={(e) => updateLine(i, { unidadLibre: e.target.value })}
                        className="w-full px-1 py-1.5 text-xs border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50"
                      >
                        {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm text-center block text-slate-500">
                        {selectedRecurso?.unidad || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <NumericInput
                      value={line.cantidad}
                      onChange={(v) => updateLine(i, { cantidad: v })}
                      step="0.001"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumericInput
                      value={line.costoSnapshot}
                      onChange={(v) => updateLine(i, { costoSnapshot: v })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-sm font-bold text-slate-700 text-right bg-white/30">
                    {line.subtotal > 0 ? formatCurrency(line.subtotal) : <span className="text-slate-300 font-normal">—</span>}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={() => removeLine(i)}
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Add buttons */}
      <div className="px-4 py-2 border-t border-white/30 flex items-center gap-4 flex-wrap">
        <button onClick={addLine}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Del catálogo
        </button>
        <button onClick={addLineLibre}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors">
          <PenLine className="w-3.5 h-3.5" />
          Texto libre
        </button>
        <button
          onClick={() => onNuevoRecurso(seccion.tipos[0], (r) => {
            onChange([...lines, { recursoId: r.id, isLibre: false, cantidad: 1, costoSnapshot: r.costoUnitario, subtotal: r.costoUnitario, observaciones: '' }])
          })}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-green-600 transition-colors">
          <PackagePlus className="w-3.5 h-3.5" />
          Nuevo recurso
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ApuEditor({ recursos: recursosProp, apusDisponibles, mode, initialData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recursosLocales, setRecursosLocales] = useState<RecursoRef[]>(recursosProp)
  const [modalConfig, setModalConfig] = useState<{ tipoDefault: string; onCreated: (r: RecursoRef) => void } | null>(null)

  const handleNuevoRecurso = useCallback((tipoDefault: string, onCreated: (r: RecursoRef) => void) => {
    setModalConfig({ tipoDefault, onCreated })
  }, [])

  const handleRecursoCreated = useCallback((recurso: RecursoRef, onCreated: (r: RecursoRef) => void) => {
    setRecursosLocales((prev) => [...prev, recurso])
    onCreated(recurso)
    setModalConfig(null)
  }, [])

  const [header, setHeader] = useState({
    codigo: initialData?.codigo || '',
    nombre: initialData?.nombre || '',
    descripcion: initialData?.descripcion || '',
    capitulo: initialData?.capitulo || '',
    unidad: initialData?.unidad || 'm2',
    indirectos: initialData?.indirectos ?? 10,
    utilidad: initialData?.utilidad ?? 20,
    desperdicio: initialData?.desperdicio ?? 5,
    activo: initialData?.activo !== false,
    observaciones: initialData?.observaciones || '',
  })

  const [sections, setSections] = useState<Record<TipoSeccion, RecursoLine[]>>(
    buildInitialSections(initialData?.recursos ?? [], SECCIONES)
  )

  const [apuLines, setApuLines] = useState<ApuLine[]>(
    buildInitialApuLines(initialData?.recursos ?? [])
  )

  const setH = (field: string, value: string | number | boolean) =>
    setHeader((prev) => ({ ...prev, [field]: value }))

  const updateSection = useCallback((key: TipoSeccion, lines: RecursoLine[]) => {
    setSections((prev) => ({ ...prev, [key]: lines }))
  }, [])

  const addApuLine = (apu: ApuRef) => {
    setApuLines((prev) => [...prev, {
      apuHijoId: apu.id,
      nombreSnapshot: apu.nombre,
      unidadSnapshot: apu.unidad,
      cantidad: 1,
      costoSnapshot: apu.precioVenta,
      subtotal: apu.precioVenta,
      observaciones: '',
    }])
  }

  const updateApuLine = (i: number, updates: Partial<ApuLine>) => {
    setApuLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l
      const updated = { ...l, ...updates }
      updated.subtotal = updated.cantidad * updated.costoSnapshot
      return updated
    }))
  }

  const removeApuLine = (i: number) => setApuLines((prev) => prev.filter((_, idx) => idx !== i))

  // ── Calculations ──────────────────────────────────────────────────────────

  const recursoLines = SECCIONES.flatMap((s) => sections[s.key])
  const costoRecursos = recursoLines.reduce((s, l) => s + l.subtotal, 0)
  const costoApus = apuLines.reduce((s, l) => s + l.subtotal, 0)
  const costoDirecto = costoRecursos + costoApus
  const costoConInd  = costoDirecto * (1 + header.indirectos / 100)
  const precioVenta  = costoConInd  * (1 + header.utilidad / 100)
  const margen       = precioVenta > 0 ? ((precioVenta - costoDirecto) / precioVenta) * 100 : 0

  const sectionTotals = SECCIONES.map((s) => ({
    ...s,
    total: sections[s.key].reduce((sum, l) => sum + l.subtotal, 0),
  }))

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!header.nombre.trim()) { setError('El nombre del APU es obligatorio'); return }
    setLoading(true)
    setError(null)
    try {
      // Resource lines (normal + libre)
      const recursoPayload = SECCIONES.flatMap((s, si) =>
        sections[s.key]
          .filter((l) => l.recursoId !== null || (l.isLibre && l.descripcionLibre?.trim()))
          .map((l, li) => ({ ...l, tipoComponente: l.isLibre ? 'libre' : 'recurso', tipoLinea: s.key, orden: si * 100 + li }))
      )
      // APU child lines
      const apuPayload = apuLines.map((l, i) => ({
        tipoComponente: 'apu',
        apuHijoId: l.apuHijoId,
        nombreSnapshot: l.nombreSnapshot,
        unidadSnapshot: l.unidadSnapshot,
        cantidad: l.cantidad,
        costoSnapshot: l.costoSnapshot,
        subtotal: l.subtotal,
        observaciones: l.observaciones,
        orden: 9000 + i,
      }))

      const payload = { ...header, recursos: [...recursoPayload, ...apuPayload] }
      const res = await fetch(
        mode === 'create' ? '/api/apus' : `/api/apus/${initialData?.id}`,
        { method: mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      router.push(mode === 'create' ? '/apus?msg=creado' : '/apus?msg=actualizado')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Datos del APU</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Código</label>
            <input type="text" value={header.codigo} onChange={(e) => setH('codigo', e.target.value)}
              placeholder="APU-001"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre <span className="text-red-500">*</span></label>
            <input type="text" value={header.nombre} onChange={(e) => setH('nombre', e.target.value)}
              placeholder="Levantado muro block 6&quot;"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Unidad</label>
            <select value={header.unidad} onChange={(e) => setH('unidad', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Capítulo</label>
            <select value={header.capitulo} onChange={(e) => setH('capitulo', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Sin capítulo</option>
              {CAPITULOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Indirectos %</label>
            <NumericInput value={header.indirectos} onChange={(v) => setH('indirectos', v)} step="0.5" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Utilidad %</label>
            <NumericInput value={header.utilidad} onChange={(v) => setH('utilidad', v)} step="0.5" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Desperdicio %</label>
            <NumericInput value={header.desperdicio} onChange={(v) => setH('desperdicio', v)} step="0.5" />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Descripción</label>
          <textarea value={header.descripcion} onChange={(e) => setH('descripcion', e.target.value)}
            rows={2} placeholder="Descripción técnica del APU..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      {/* Resource sections */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide px-1">Composición de Recursos</h2>
        {SECCIONES.map((sec) => (
          <SeccionRecursos
            key={sec.key}
            seccion={sec}
            lines={sections[sec.key]}
            recursosDisponibles={recursosLocales}
            onChange={(lines) => updateSection(sec.key, lines)}
            onNuevoRecurso={handleNuevoRecurso}
          />
        ))}
      </div>

      {/* Sub-APUs section */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-indigo-100 text-indigo-800">
          <span className="text-xs font-bold uppercase tracking-wide">Sub-APUs (Componentes)</span>
          <div className="flex items-center gap-3">
            {costoApus > 0 && <span className="text-xs font-semibold">{formatCurrency(costoApus)}</span>}
            <span className="text-xs opacity-60">{apuLines.length} componente{apuLines.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* APU Lines table */}
        {apuLines.length > 0 && (
          <table className="w-full border-t border-white/50">
            <thead>
              <tr className="bg-white/40 text-xs text-slate-500">
                <th className="px-2 py-1.5 text-left font-semibold w-6">#</th>
                <th className="px-3 py-1.5 text-left font-semibold">APU</th>
                <th className="px-3 py-1.5 text-center font-semibold w-16">Unidad</th>
                <th className="px-3 py-1.5 text-right font-semibold w-24">Cantidad</th>
                <th className="px-3 py-1.5 text-right font-semibold w-32">Costo Unit.</th>
                <th className="px-3 py-1.5 text-right font-semibold w-32 bg-white/40">Subtotal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {apuLines.map((line, i) => (
                <tr key={i} className="border-t border-white/40 hover:bg-white/60 group transition-colors">
                  <td className="px-2 py-1.5 text-xs text-slate-400 select-none">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-200 text-indigo-800">APU</span>
                      <span className="text-sm text-slate-700 font-medium">{line.nombreSnapshot}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-sm text-center text-slate-500">{line.unidadSnapshot}</td>
                  <td className="px-2 py-1">
                    <NumericInput
                      value={line.cantidad}
                      onChange={(v) => updateApuLine(i, { cantidad: v })}
                      step="0.001"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <NumericInput
                      value={line.costoSnapshot}
                      onChange={(v) => updateApuLine(i, { costoSnapshot: v })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-sm font-bold text-slate-700 text-right bg-white/30">
                    {line.subtotal > 0 ? formatCurrency(line.subtotal) : <span className="text-slate-300 font-normal">—</span>}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={() => removeApuLine(i)}
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add APU button */}
        <div className="px-4 py-2 border-t border-white/30">
          <ApuSearch apus={apusDisponibles} onSelect={addApuLine} />
        </div>
      </div>

      {/* NuevoRecursoModal */}
      {modalConfig && (
        <NuevoRecursoModal
          tipoDefault={modalConfig.tipoDefault}
          onCreated={(r) => handleRecursoCreated(r, modalConfig.onCreated)}
          onClose={() => setModalConfig(null)}
        />
      )}

      {/* Summary panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Desglose de costos</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {sectionTotals.filter((s) => s.total > 0).map((s) => (
                <tr key={s.key}>
                  <td className="py-1.5 text-slate-600">{s.label}</td>
                  <td className="py-1.5 text-right font-medium text-slate-700">{formatCurrency(s.total)}</td>
                </tr>
              ))}
              {costoApus > 0 && (
                <tr>
                  <td className="py-1.5 text-indigo-600 flex items-center gap-1">
                    <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700">APU</span>
                    Sub-APUs
                  </td>
                  <td className="py-1.5 text-right font-medium text-indigo-700">{formatCurrency(costoApus)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 font-bold text-slate-700">Costo Directo</td>
                <td className="py-2 text-right font-bold text-slate-800">{formatCurrency(costoDirecto)}</td>
              </tr>
              {header.indirectos > 0 && (
                <tr>
                  <td className="py-1.5 text-slate-500">+ Indirectos ({header.indirectos}%)</td>
                  <td className="py-1.5 text-right text-slate-600">{formatCurrency(costoConInd - costoDirecto)}</td>
                </tr>
              )}
              {header.utilidad > 0 && (
                <tr>
                  <td className="py-1.5 text-slate-500">+ Utilidad ({header.utilidad}%)</td>
                  <td className="py-1.5 text-right text-slate-600">{formatCurrency(precioVenta - costoConInd)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Price result */}
        <div className="bg-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Precio de Venta</p>
            <p className="text-4xl font-bold text-white tabular-nums">{formatCurrency(precioVenta)}</p>
            <p className="text-slate-400 text-sm mt-1">por {header.unidad || 'unidad'}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-700 rounded-lg px-3 py-2">
              <p className="text-slate-400 text-xs">Costo directo</p>
              <p className="text-white font-semibold text-sm">{formatCurrency(costoDirecto)}</p>
            </div>
            <div className="bg-slate-700 rounded-lg px-3 py-2">
              <p className="text-slate-400 text-xs">Margen</p>
              <p className="text-green-400 font-semibold text-sm">{margen.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones + activo */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones</label>
          <textarea value={header.observaciones} onChange={(e) => setH('observaciones', e.target.value)}
            rows={2} placeholder="Notas sobre este APU..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="activo-apu" checked={header.activo} onChange={(e) => setH('activo', e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
          <label htmlFor="activo-apu" className="text-sm font-medium text-slate-700">APU activo (disponible en presupuestos)</label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="secondary" onClick={() => router.push('/apus')} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSave} disabled={loading} className="min-w-36">
          {loading ? 'Guardando...' : <><Save className="w-4 h-4" />{mode === 'create' ? 'Crear APU' : 'Guardar Cambios'}</>}
        </Button>
      </div>
    </div>
  )
}
