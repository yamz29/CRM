'use client'

import { useState, useCallback, Fragment } from 'react'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, BarChart2, Save, CheckCircle, X,
  Search,
} from 'lucide-react'
import { RecursoPickerModal } from './RecursoPickerModal'
import {
  type LineaAPU, type DetalleAPU, type Analisis, type Partida, type SeccionAPU,
  SECCIONES_APU, emptyLinea, emptyDetalle, lineaSubtotal,
  calcAnalisisFromDetalle, NumericCellSimple,
} from './presupuesto-v2-core'

// ── APU helpers (unchanged) ───────────────────────────────────────────────────

function SeccionLineas({ seccion, lineas, onChange, unidades }: { seccion: { key: SeccionAPU; label: string; color: string }; lineas: LineaAPU[]; onChange: (lines: LineaAPU[]) => void; unidades: string[] }) {
  const [pickerRow, setPickerRow] = useState<number | null>(null)
  const total = lineas.reduce((s, l) => s + lineaSubtotal(l), 0)
  const addLinea = () => onChange([...lineas, emptyLinea()])
  const updateLinea = (i: number, field: keyof LineaAPU, val: string | number) => onChange(lineas.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  const removeLinea = (i: number) => onChange(lineas.filter((_, idx) => idx !== i))
  return (
    <div className={`rounded-lg border ${seccion.color} overflow-hidden`}>
      {pickerRow !== null && (
        <RecursoPickerModal
          onSelect={(r) => {
            updateLinea(pickerRow, 'descripcion', r.nombre)
            updateLinea(pickerRow, 'unidad', r.unidad)
            updateLinea(pickerRow, 'precioUnitario', r.costoUnitario)
          }}
          onClose={() => setPickerRow(null)}
        />
      )}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{seccion.label}</span>
        {total > 0 && <span className="text-xs font-semibold text-foreground">{formatCurrency(total)}</span>}
      </div>
      {lineas.length > 0 && (
        <table className="w-full border-t border-border/60">
          <thead><tr className="bg-white/60">
            <th className="px-2 py-1 text-left text-xs text-muted-foreground font-medium w-6">#</th>
            <th className="px-2 py-1 text-left text-xs text-muted-foreground font-semibold">Descripción</th>
            <th className="px-2 py-1 text-center text-xs text-muted-foreground font-semibold w-20">Unidad</th>
            <th className="px-2 py-1 text-right text-xs text-muted-foreground font-semibold w-20">Cantidad</th>
            <th className="px-2 py-1 text-right text-xs text-muted-foreground font-semibold w-28">P. Unitario</th>
            <th className="px-2 py-1 text-right text-xs text-muted-foreground font-semibold w-28">Subtotal</th>
            <th className="w-8" />
          </tr></thead>
          <tbody>
            {lineas.map((linea, i) => (
              <tr key={i} className="border-t border-border/40 hover:bg-white/70 group">
                <td className="px-2 py-1 text-xs text-muted-foreground text-center select-none">{i + 1}</td>
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5">
                    <input type="text" value={linea.descripcion} onChange={(e) => updateLinea(i, 'descripcion', e.target.value)} placeholder="Descripción..." className="flex-1 min-w-0 px-2 py-1 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-card hover:border-border bg-transparent transition-colors" />
                    <button onClick={() => setPickerRow(i)} aria-label="Buscar en catálogo" title="Buscar en catálogo" className="p-1 rounded text-muted-foreground/70 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"><Search className="w-3 h-3" /></button>
                  </div>
                </td>
                <td className="px-1 py-0.5"><select value={linea.unidad} onChange={(e) => updateLinea(i, 'unidad', e.target.value)} className="w-full px-1 py-1 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-card hover:border-border bg-transparent text-center transition-colors">{unidades.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                <td className="px-1 py-0.5"><NumericCellSimple value={linea.cantidad} onChange={(v) => updateLinea(i, 'cantidad', v)} step="0.0001" /></td>
                <td className="px-1 py-0.5"><NumericCellSimple value={linea.precioUnitario} onChange={(v) => updateLinea(i, 'precioUnitario', v)} /></td>
                <td className="px-2 py-1 text-right text-sm font-semibold text-foreground whitespace-nowrap">{lineaSubtotal(linea) > 0 ? formatCurrency(lineaSubtotal(linea)) : <span className="text-muted-foreground/70 font-normal">—</span>}</td>
                <td className="px-1 py-0.5"><button onClick={() => removeLinea(i)} className="p-1 rounded text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="px-3 py-1.5 border-t border-border/40">
        <button onClick={addLinea} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-medium transition-colors"><Plus className="w-3 h-3" /> Agregar {seccion.label.toLowerCase()}</button>
      </div>
    </div>
  )
}

export function ApuPanel({ partida, onClose, onUpdate, onApply, unidades }: { partida: Partida; onClose: () => void; onUpdate: (a: Analisis) => void; onApply: () => void; unidades: string[] }) {
  const analisis = partida.analisis
  const detalle: DetalleAPU = analisis?.detalle ?? emptyDetalle()
  const indirectos = analisis?.indirectos ?? 0
  const utilidad = analisis?.utilidad ?? 0
  const calc = calcAnalisisFromDetalle(detalle, indirectos, utilidad)
  const updateDetalle = useCallback((key: SeccionAPU, lines: LineaAPU[]) => { onUpdate(calcAnalisisFromDetalle({ ...detalle, [key]: lines }, indirectos, utilidad)) }, [detalle, indirectos, utilidad, onUpdate])
  const updatePct = useCallback((field: 'indirectos' | 'utilidad', val: number) => { onUpdate(calcAnalisisFromDetalle(detalle, field === 'indirectos' ? val : indirectos, field === 'utilidad' ? val : utilidad)) }, [detalle, indirectos, utilidad, onUpdate])

  // ── Save to APU catalog ───────────────────────────────────────────
  const [savingToCatalog, setSavingToCatalog] = useState(false)
  const [savedToCatalog, setSavedToCatalog] = useState(false)

  async function handleSaveToCatalog() {
    setSavingToCatalog(true)
    try {
      // Map detalle sections to ApuRecurso format
      const tipoLineaMap: Record<string, string> = {
        materiales: 'material', manoObra: 'mano_obra', equipos: 'equipo',
        subcontratos: 'subcontrato', transporte: 'transporte',
      }
      const recursos: { tipoComponente: string; descripcionLibre: string; unidadLibre: string; tipoLinea: string; cantidad: number; costoSnapshot: number; subtotal: number }[] = []
      for (const [secKey, lines] of Object.entries(detalle)) {
        for (const line of lines as LineaAPU[]) {
          if (!line.descripcion.trim()) continue
          recursos.push({
            tipoComponente: 'libre',
            descripcionLibre: line.descripcion,
            unidadLibre: line.unidad,
            tipoLinea: tipoLineaMap[secKey] || secKey,
            cantidad: line.cantidad,
            costoSnapshot: line.precioUnitario,
            subtotal: line.cantidad * line.precioUnitario,
          })
        }
      }

      const res = await fetch('/api/apus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: partida.descripcion || 'APU sin nombre',
          unidad: partida.unidad || 'gl',
          indirectos,
          utilidad,
          recursos,
        }),
      })

      if (res.ok) {
        setSavedToCatalog(true)
        setTimeout(() => setSavedToCatalog(false), 3000)
      }
    } catch (e) {
      console.error('Error saving to catalog:', e)
    }
    setSavingToCatalog(false)
  }
  return (
    <div className="bg-muted/40 border-y border-blue-200">
      <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-blue-600" /><span className="text-sm font-bold text-foreground">Análisis de Precio Unitario</span>{partida.descripcion && <span className="text-sm text-muted-foreground">— {partida.descripcion}</span>}</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground transition-colors"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-6 py-4 space-y-3">
        {SECCIONES_APU.map((sec) => <SeccionLineas key={sec.key} seccion={sec} lineas={detalle[sec.key]} onChange={(lines) => updateDetalle(sec.key, lines)} unidades={unidades} />)}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Porcentajes</p>
            <div className="space-y-2">
              {(['indirectos', 'utilidad'] as const).map(field => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">{field === 'indirectos' ? 'Gastos indirectos' : 'Utilidad'}</label>
                  <div className="flex items-center gap-1"><NumericCellSimple value={field === 'indirectos' ? indirectos : utilidad} onChange={(v) => updatePct(field, v)} step="0.5" /><span className="text-sm text-muted-foreground flex-shrink-0">%</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Resumen</p>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {SECCIONES_APU.filter(s => (calc[s.key as keyof Analisis] as number) > 0).map(s => (
                  <tr key={s.key}><td className="py-1 text-muted-foreground">{s.label}</td><td className="py-1 text-right font-medium text-foreground">{formatCurrency(calc[s.key as keyof Analisis] as number)}</td></tr>
                ))}
                <tr className="border-t-2 border-border"><td className="py-1.5 text-muted-foreground font-semibold">Costo Directo</td><td className="py-1.5 text-right font-bold text-foreground">{formatCurrency(calc.costoDirecto)}</td></tr>
                {indirectos > 0 && <tr><td className="py-1 text-muted-foreground">Indirectos ({indirectos}%)</td><td className="py-1 text-right text-muted-foreground">+{formatCurrency(calc.costoTotal - calc.costoDirecto)}</td></tr>}
                {utilidad > 0 && <tr><td className="py-1 text-muted-foreground">Utilidad ({utilidad}%)</td><td className="py-1 text-right text-muted-foreground">+{formatCurrency(calc.precioSugerido - calc.costoTotal)}</td></tr>}
                <tr className="bg-blue-50"><td className="py-2 px-1 font-bold text-blue-700 rounded-l">Precio sugerido</td><td className="py-2 px-1 text-right font-bold text-blue-700 text-base rounded-r">{formatCurrency(calc.precioSugerido)}</td></tr>
                <tr><td className="py-1 text-muted-foreground">Margen</td><td className="py-1 text-right font-semibold text-green-600">{calc.margen.toFixed(1)}%</td></tr>
              </tbody>
            </table>
            <button onClick={onApply} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><CheckCircle className="w-4 h-4" />Aplicar {formatCurrency(calc.precioSugerido)} al presupuesto</button>
            <button
              onClick={handleSaveToCatalog}
              disabled={savingToCatalog || savedToCatalog || calc.costoDirecto === 0}
              className={`mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                savedToCatalog
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
              }`}
            >
              {savingToCatalog ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Guardando...</>
              ) : savedToCatalog ? (
                <><CheckCircle className="w-4 h-4" /> Guardado en catálogo APU</>
              ) : (
                <><Save className="w-4 h-4" /> Guardar en catálogo APU</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

