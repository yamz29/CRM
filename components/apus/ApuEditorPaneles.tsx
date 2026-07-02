'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency } from '@/lib/utils'
import { Plus, X, PackagePlus, PenLine, BookOpen, Search } from 'lucide-react'
import {
  type RecursoRef, type ApuRef, type RecursoLine, SECCIONES, UNIDADES, NumericInput,
} from './apu-core'

// ── NuevoRecursoModal ─────────────────────────────────────────────────────────

export function NuevoRecursoModal({ tipoDefault, onCreated, onClose }: {
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
      <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-blue-600" />
            Nuevo Recurso
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {err && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded px-3 py-2">{err}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Nombre <span className="text-red-500">*</span></label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
              placeholder="Ej: Block de hormigón 6&quot;"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIPOS_RECURSO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Unidad</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-blue-500">
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Costo Unitario (RD$)</label>
            <NumericInput value={costo} onChange={setCosto} step="0.01" placeholder="0.00" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2">
            {saving ? 'Creando...' : <><Plus className="w-3.5 h-3.5" />Crear y agregar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RecursoSearch ─────────────────────────────────────────────────────────────

export function RecursoSearch({ recursos, selectedId, onSelect }: {
  recursos: RecursoRef[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const selected = selectedId ? recursos.find((r) => r.id === selectedId) : null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Position the dropdown based on the input's bounding rect (used by the portal)
  const updateRect = useCallback(() => {
    const el = inputRef.current ?? containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    updateRect()
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open, updateRect])

  // Close on outside click (must also ignore clicks inside the portal)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
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
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, código, tipo..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card"
            />
          </div>
          {typeof window !== 'undefined' && dropdownRect && createPortal(
            <div
              ref={dropdownRef}
              style={{ position: 'fixed', top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
              className="bg-card border border-border rounded-lg shadow-xl max-h-72 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground italic">Sin resultados para &quot;{query}&quot;</p>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={() => handleSelect(r)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-border last:border-0 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {r.codigo && <span className="font-mono text-muted-foreground mr-1">[{r.codigo}]</span>}
                          {r.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">{r.tipo} · {r.unidad}</span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatCurrency(r.costoUnitario)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>,
            document.body
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left px-2 py-1.5 text-sm border border-border rounded focus:outline-none hover:border-blue-400 bg-card transition-colors flex items-center justify-between gap-2"
        >
          {selected ? (
            <span className="truncate text-foreground">
              {selected.codigo && <span className="font-mono text-muted-foreground mr-1 text-xs">[{selected.codigo}]</span>}
              {selected.nombre}
            </span>
          ) : (
            <span className="text-muted-foreground">— Buscar recurso —</span>
          )}
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      )}
    </div>
  )
}

// ── ApuSearch ─────────────────────────────────────────────────────────────────

export function ApuSearch({ apus, onSelect }: {
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar APU por nombre, código o capítulo..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-card"
        />
      </div>
      <div className="absolute top-10 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground italic">Sin resultados para &quot;{query}&quot;</p>
        ) : (
          filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => { onSelect(a); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-border last:border-0 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {a.codigo && <span className="font-mono text-muted-foreground mr-1">[{a.codigo}]</span>}
                    {a.nombre}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.capitulo && <span className="mr-2">{a.capitulo}</span>}
                    <span>{a.unidad}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-bold text-indigo-700">{formatCurrency(a.precioVenta)}</div>
                  <div className="text-xs text-muted-foreground">/{a.unidad}</div>
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

export function SeccionRecursos({
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
            <tr className="bg-card/40 text-xs text-muted-foreground">
              <th className="px-2 py-1.5 text-left font-semibold w-6">#</th>
              <th className="px-2 py-1.5 w-7" title="Alternar entre catálogo y texto libre" />
              <th className="px-3 py-1.5 text-left font-semibold">Recurso / Descripción</th>
              <th className="px-3 py-1.5 text-center font-semibold w-16">Unidad</th>
              <th className="px-3 py-1.5 text-right font-semibold w-24">Cantidad</th>
              <th className="px-3 py-1.5 text-right font-semibold w-32">Costo Unit.</th>
              <th className="px-3 py-1.5 text-right font-semibold w-32 bg-card/40">Subtotal</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const selectedRecurso = !line.isLibre && line.recursoId
                ? recursosDisponibles.find((r) => r.id === line.recursoId)
                : null
              return (
                <tr key={i} className="border-t border-white/40 hover:bg-card/60 group transition-colors">
                  <td className="px-2 py-1.5 text-xs text-muted-foreground select-none">{i + 1}</td>
                  {/* Toggle catálogo / libre */}
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => toggleLibre(i)}
                      title={line.isLibre ? 'Usar recurso del catálogo' : 'Escribir texto libre'}
                      className={`p-1 rounded transition-colors ${line.isLibre ? 'text-amber-500 hover:bg-amber-50' : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-50'}`}
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
                      <span className="text-sm text-center block text-muted-foreground">
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
                  <td className="px-3 py-1.5 text-sm font-bold text-foreground text-right bg-card/30">
                    {line.subtotal > 0 ? formatCurrency(line.subtotal) : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={() => removeLine(i)}
                      className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
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
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-blue-600 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Del catálogo
        </button>
        <button onClick={addLineLibre}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-amber-600 transition-colors">
          <PenLine className="w-3.5 h-3.5" />
          Texto libre
        </button>
        <button
          onClick={() => onNuevoRecurso(seccion.tipos[0], (r) => {
            onChange([...lines, { recursoId: r.id, isLibre: false, cantidad: 1, costoSnapshot: r.costoUnitario, subtotal: r.costoUnitario, observaciones: '' }])
          })}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-green-600 transition-colors">
          <PackagePlus className="w-3.5 h-3.5" />
          Nuevo recurso
        </button>
      </div>
    </div>
  )
}

