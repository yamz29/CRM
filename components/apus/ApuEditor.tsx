'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Save, AlertCircle, X } from 'lucide-react'
import {
  type RecursoRef, type ApuRef, type RecursoLine, type ApuLine, type TipoSeccion, type Props,
  SECCIONES, UNIDADES, CAPITULOS, buildInitialSections, buildInitialApuLines, NumericInput,
} from './apu-core'
import { NuevoRecursoModal, ApuSearch, SeccionRecursos } from './ApuEditorPaneles'

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
    rendimiento: initialData?.rendimiento ?? null as number | null,
    volumenAnalisis: initialData?.volumenAnalisis ?? null as number | null,
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
  const precioBruto  = costoConInd  * (1 + header.utilidad / 100)
  const divisor      = header.volumenAnalisis && header.volumenAnalisis > 0 ? header.volumenAnalisis : 1
  const precioVenta  = precioBruto / divisor
  const margen       = precioVenta > 0 ? ((precioVenta - costoDirecto / divisor) / precioVenta) * 100 : 0

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
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 text-red-700 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Header fields */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">Datos del APU</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Código</label>
            <input type="text" value={header.codigo} onChange={(e) => setH('codigo', e.target.value)}
              placeholder="APU-001"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Nombre <span className="text-red-500">*</span></label>
            <input type="text" value={header.nombre} onChange={(e) => setH('nombre', e.target.value)}
              placeholder="Levantado muro block 6&quot;"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Unidad</label>
            <select value={header.unidad} onChange={(e) => setH('unidad', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card">
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Capítulo</label>
            <select value={header.capitulo} onChange={(e) => setH('capitulo', e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card">
              <option value="">Sin capítulo</option>
              {CAPITULOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Indirectos %</label>
            <NumericInput value={header.indirectos} onChange={(v) => setH('indirectos', v)} step="0.5" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Utilidad %</label>
            <NumericInput value={header.utilidad} onChange={(v) => setH('utilidad', v)} step="0.5" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Desperdicio %</label>
            <NumericInput value={header.desperdicio} onChange={(v) => setH('desperdicio', v)} step="0.5" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Rendimiento <span className="font-normal text-muted-foreground">(unidades/día)</span>
            </label>
            <input
              type="number" min="0" step="0.5"
              value={header.rendimiento ?? ''}
              onChange={(e) => setHeader(p => ({ ...p, rendimiento: e.target.value === '' ? null : parseFloat(e.target.value) }))}
              placeholder="Ej: 20"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-0.5">Para calcular duración en cronograma: Cantidad ÷ Rendimiento</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Volumen de análisis
            </label>
            <input
              type="number" min="0" step="any"
              value={header.volumenAnalisis ?? ''}
              onChange={(e) => setHeader(p => ({ ...p, volumenAnalisis: e.target.value === '' ? null : parseFloat(e.target.value) }))}
              placeholder="Ej: 10"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground mt-0.5">El precio de venta se divide entre este valor (vacío = 1)</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Descripción</label>
          <textarea value={header.descripcion} onChange={(e) => setH('descripcion', e.target.value)}
            rows={2} placeholder="Descripción técnica del APU..."
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      {/* Resource sections */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">Composición de Recursos</h2>
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
              <tr className="bg-card/40 text-xs text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-semibold w-6">#</th>
                <th className="px-3 py-1.5 text-left font-semibold">APU</th>
                <th className="px-3 py-1.5 text-center font-semibold w-16">Unidad</th>
                <th className="px-3 py-1.5 text-right font-semibold w-24">Cantidad</th>
                <th className="px-3 py-1.5 text-right font-semibold w-32">Costo Unit.</th>
                <th className="px-3 py-1.5 text-right font-semibold w-32 bg-card/40">Subtotal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {apuLines.map((line, i) => (
                <tr key={i} className="border-t border-white/40 hover:bg-card/60 group transition-colors">
                  <td className="px-2 py-1.5 text-xs text-muted-foreground select-none">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-indigo-200 text-indigo-800">APU</span>
                      <span className="text-sm text-foreground font-medium">{line.nombreSnapshot}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-sm text-center text-muted-foreground">{line.unidadSnapshot}</td>
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
                  <td className="px-3 py-1.5 text-sm font-bold text-foreground text-right bg-card/30">
                    {line.subtotal > 0 ? formatCurrency(line.subtotal) : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={() => removeApuLine(i)}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
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
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Desglose de costos</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {sectionTotals.filter((s) => s.total > 0).map((s) => (
                <tr key={s.key}>
                  <td className="py-1.5 text-muted-foreground">{s.label}</td>
                  <td className="py-1.5 text-right font-medium text-foreground">{formatCurrency(s.total)}</td>
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
              <tr className="border-t-2 border-border">
                <td className="py-2 font-bold text-foreground">Costo Directo</td>
                <td className="py-2 text-right font-bold text-foreground">{formatCurrency(costoDirecto)}</td>
              </tr>
              {header.indirectos > 0 && (
                <tr>
                  <td className="py-1.5 text-muted-foreground">+ Indirectos ({header.indirectos}%)</td>
                  <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(costoConInd - costoDirecto)}</td>
                </tr>
              )}
              {header.utilidad > 0 && (
                <tr>
                  <td className="py-1.5 text-muted-foreground">+ Utilidad ({header.utilidad}%)</td>
                  <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(precioBruto - costoConInd)}</td>
                </tr>
              )}
              {divisor !== 1 && (
                <>
                  <tr className="border-t border-border">
                    <td className="py-1.5 text-muted-foreground font-medium">Total bruto</td>
                    <td className="py-1.5 text-right font-medium text-foreground">{formatCurrency(precioBruto)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-amber-600">÷ Volumen de análisis</td>
                    <td className="py-1.5 text-right text-amber-700">{divisor}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Price result */}
        <div className="bg-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">Precio de Venta</p>
            <p className="text-4xl font-bold text-white tabular-nums">{formatCurrency(precioVenta)}</p>
            <p className="text-muted-foreground text-sm mt-1">por {header.unidad || 'unidad'}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-700 rounded-lg px-3 py-2">
              <p className="text-muted-foreground text-xs">Costo directo</p>
              <p className="text-white font-semibold text-sm">{formatCurrency(costoDirecto / divisor)}</p>
            </div>
            <div className="bg-slate-700 rounded-lg px-3 py-2">
              <p className="text-muted-foreground text-xs">Margen</p>
              <p className="text-green-400 font-semibold text-sm">{margen.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones + activo */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">Observaciones</label>
          <textarea value={header.observaciones} onChange={(e) => setH('observaciones', e.target.value)}
            rows={2} placeholder="Notas sobre este APU..."
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="activo-apu" checked={header.activo} onChange={(e) => setH('activo', e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
          <label htmlFor="activo-apu" className="text-sm font-medium text-foreground">APU activo (disponible en presupuestos)</label>
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
