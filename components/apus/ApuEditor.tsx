'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, Save, AlertCircle, X, PackagePlus } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecursoRef {
  id: number
  codigo?: string | null
  nombre: string
  tipo: string
  unidad: string
  costoUnitario: number
}

interface RecursoLine {
  recursoId: number | null
  cantidad: number
  costoSnapshot: number
  subtotal: number
  observaciones: string
}

type TipoSeccion = 'materiales' | 'manoObra' | 'equipos' | 'subcontratos' | 'transportes'

interface Props {
  recursos: RecursoRef[]
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
      recursoId: number
      cantidad: number
      costoSnapshot: number
      subtotal: number
      observaciones?: string | null
      recurso: RecursoRef
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

const UNIDADES = ['gl', 'ud', 'm2', 'ml', 'm3', 'm', 'kg', 'ton', 'lt', 'saco', 'pl', 'par', 'hr', 'día', 'sem', 'mes', 'viaje', 'jg']

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
    const sec = secciones.find((s) => s.tipos.includes(ar.recurso.tipo))
    if (sec) {
      result[sec.key].push({
        recursoId: ar.recursoId,
        cantidad: ar.cantidad,
        costoSnapshot: ar.costoSnapshot,
        subtotal: ar.subtotal,
        observaciones: ar.observaciones || '',
      })
    }
  }
  return result
}

// ── NumericInput ──────────────────────────────────────────────────────────────

function NumericInput({ value, onChange, step = '1', placeholder = '0', className = '' }: {
  value: number; onChange: (v: number) => void; step?: string; placeholder?: string; className?: string
}) {
  const [focused, setFocused] = useState(false)
  const display = focused ? (value === 0 ? '' : String(value)) : value === 0 ? '' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })
  return (
    <input
      type={focused ? 'number' : 'text'}
      value={display}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      onFocus={(e) => { setFocused(true); setTimeout(() => e.target.select(), 0) }}
      onBlur={() => setFocused(false)}
      step={step}
      min="0"
      placeholder={placeholder}
      className={`w-full px-2 py-1.5 text-sm text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
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
    onChange([...lines, { recursoId: null, cantidad: 1, costoSnapshot: 0, subtotal: 0, observaciones: '' }])

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
              <th className="px-3 py-1.5 text-left font-semibold w-6">#</th>
              <th className="px-3 py-1.5 text-left font-semibold">Recurso</th>
              <th className="px-3 py-1.5 text-center font-semibold w-14">Unidad</th>
              <th className="px-3 py-1.5 text-right font-semibold w-24">Cantidad</th>
              <th className="px-3 py-1.5 text-right font-semibold w-32">Costo Unit.</th>
              <th className="px-3 py-1.5 text-right font-semibold w-32 bg-white/40">Subtotal</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const selectedRecurso = line.recursoId
                ? recursosDisponibles.find((r) => r.id === line.recursoId)
                : null
              return (
                <tr key={i} className="border-t border-white/40 hover:bg-white/60 group transition-colors">
                  <td className="px-3 py-1.5 text-xs text-slate-400 select-none">{i + 1}</td>
                  <td className="px-2 py-1">
                    <select
                      value={line.recursoId ?? ''}
                      onChange={(e) => selectRecurso(i, parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Seleccionar recurso —</option>
                      {recursos.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo ? `[${r.codigo}] ` : ''}{r.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-sm text-center text-slate-500">
                    {selectedRecurso?.unidad || '—'}
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
      <div className="px-4 py-2 border-t border-white/30 flex items-center gap-4">
        <button onClick={addLine}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Agregar {seccion.label.toLowerCase()}
        </button>
        <button
          onClick={() => onNuevoRecurso(seccion.tipos[0], (r) => {
            onChange([...lines, { recursoId: r.id, cantidad: 1, costoSnapshot: r.costoUnitario, subtotal: r.costoUnitario, observaciones: '' }])
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

export function ApuEditor({ recursos: recursosProp, mode, initialData }: Props) {
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

  const setH = (field: string, value: string | number | boolean) =>
    setHeader((prev) => ({ ...prev, [field]: value }))

  const updateSection = useCallback((key: TipoSeccion, lines: RecursoLine[]) => {
    setSections((prev) => ({ ...prev, [key]: lines }))
  }, [])

  // ── Calculations ──────────────────────────────────────────────────────────

  const allLines = SECCIONES.flatMap((s) => sections[s.key])
  const costoDirecto = allLines.reduce((s, l) => s + l.subtotal, 0)
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
      const payload = {
        ...header,
        recursos: SECCIONES.flatMap((s, si) =>
          sections[s.key]
            .filter((l) => l.recursoId !== null)
            .map((l, li) => ({ ...l, orden: si * 100 + li }))
        ),
      }
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
