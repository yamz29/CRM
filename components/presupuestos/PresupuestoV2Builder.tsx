'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Trash2, Copy, BarChart2, ChevronUp, ChevronDown,
  ChevronRight, Save, AlertCircle, CheckCircle, X,
  FileSpreadsheet, FileText, Layers, Percent, Tag, } from 'lucide-react'
import { ApuSearchModal } from './ApuSearchModal'
import ImportarExcelModal, { ImportResult } from './ImportarExcelModal'
import { QuickTextPicker } from './QuickTextPicker'
import {
  type Analisis, type Partida, type Capitulo,
  type Titulo, type IndirectoLinea, type Props, CHAPTER_TEMPLATES, TITLE_TEMPLATES, DEFAULT_INDIRECTO_LINEAS, UNIDADES, ESTADOS,
  TAB_FIELDS, emptyPartida, emptyNota, emptyCapitulo, cellKey,
  focusCell, nextPK, NumericCell, } from './presupuesto-v2-core'
import { ApuPanel } from './ApuPanel'

// ── Main Component ─────────────────────────────────────────────────────────────

export function PresupuestoV2Builder({ clientes, proyectos, unidadesGlobales, mode, initialData, defaultClienteId, defaultProyectoId }: Props) {
  const UNIDADES_LIST = unidadesGlobales?.length ? unidadesGlobales : UNIDADES
  const router = useRouter()

  const [clienteId, setClienteId] = useState<string>(String(initialData?.clienteId || defaultClienteId || ''))
  const [proyectoId, setProyectoId] = useState<string>(String(initialData?.proyectoId || defaultProyectoId || ''))
  const [estado, setEstado] = useState(initialData?.estado || 'Borrador')
  const [notas, setNotas] = useState(initialData?.notas || '')
  const [descuentoTipo, setDescuentoTipo] = useState(initialData?.descuentoTipo || 'ninguno')
  const [descuentoValor, setDescuentoValor] = useState(initialData?.descuentoValor || 0)
  const [itbisActivo, setItbisActivo] = useState(initialData?.itbisActivo || false)
  const [itbisPorcentaje, setItbisPorcentaje] = useState(initialData?.itbisPorcentaje ?? 18)
  const [titulos, setTitulos] = useState<Titulo[]>(initialData?.titulos || [])
  const [capitulos, setCapitulos] = useState<Capitulo[]>(
    (initialData?.capitulos || []).map(cap => ({
      ...cap,
      partidas: cap.partidas.map(p => ({ ...p, _key: p._key ?? (p.id ? `db-${p.id}` : nextPK()) })),
    }))
  )
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
  const [showQuickTextPicker, setShowQuickTextPicker] = useState(false)

  // ── Detección de cambios sin guardar ───────────────────────────────────────
  // Marca dirty=true en cuanto el usuario toca cualquier campo. Se resetea al
  // guardar exitosamente. Si dirty, el hook avisa antes de cerrar tab, hacer
  // back, o clickear cualquier link del sidebar/header.
  const [dirty, setDirty] = useState(false)
  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    setDirty(true)
  }, [clienteId, proyectoId, estado, notas, descuentoTipo, descuentoValor,
      itbisActivo, itbisPorcentaje, titulos, capitulos, indirectoLineas])
  useUnsavedChangesWarning(dirty)

  // ── Excel import handler ───────────────────────────────────────────────────

  const handleImport = useCallback((result: ImportResult) => {
    const newTitulos: Titulo[] = result.titulos.map(t => ({ nombre: t.nombre, orden: t.orden }))
    const newCapitulos: Capitulo[] = result.capitulos.map((cap, ci) => ({
      codigo: '',
      nombre: cap.nombre,
      orden: ci,
      tituloIdx: cap.tituloIdx,
      partidas: cap.partidas.map((p, pi) => ({
        _key: nextPK(),
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
  const subtotalBase = capitulos.reduce((acc, cap) => acc + cap.partidas.reduce((a, p) => a + (p.esNota ? 0 : p.subtotal), 0), 0)
  const subtotalIndirecto = indirectoLineas.filter(l => l.activo).reduce((s, l) => s + subtotalBase * l.porcentaje / 100, 0)
  const subtotalAntesDescuento = subtotalBase + subtotalIndirecto
  const montoDescuento = descuentoTipo === 'porcentaje'
    ? subtotalAntesDescuento * descuentoValor / 100
    : descuentoTipo === 'fijo' ? descuentoValor : 0
  const subtotalConDescuento = subtotalAntesDescuento - montoDescuento
  const montoItbis = itbisActivo ? subtotalConDescuento * itbisPorcentaje / 100 : 0
  const grandTotal = subtotalConDescuento + montoItbis

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

  const addNota = useCallback((ci: number) => {
    setCapitulos(prev => {
      const next = [...prev]
      next[ci] = { ...next[ci], partidas: [...next[ci].partidas, emptyNota(next[ci].partidas.length)] }
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

  const movePartida = useCallback((ci: number, pi: number, dir: -1 | 1) => {
    setCapitulos(prev => {
      const next = [...prev]
      const partidas = [...next[ci].partidas]
      const target = pi + dir
      if (target < 0 || target >= partidas.length) return prev
      ;[partidas[pi], partidas[target]] = [partidas[target], partidas[pi]]
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
      const copy = { ...partidas[pi], id: undefined, _key: nextPK(), orden: partidas.length }
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
    setCapitulos(prev => { const next = [...prev]; next[ci] = { ...next[ci], partidas: [...next[ci].partidas, { ...partida, _key: nextPK(), id: undefined, orden: next[ci].partidas.length }] }; return next })
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

  const handleSave = async (opts?: { preview?: boolean }) => {
    setError(null)
    if (!clienteId) { setError('Selecciona un cliente antes de guardar.'); return }
    setLoading(true)
    try {
      const payload = { clienteId: parseInt(clienteId), proyectoId: proyectoId ? parseInt(proyectoId) : null, estado, notas, titulos, capitulos, indirectoLineas, descuentoTipo, descuentoValor, itbisActivo, itbisPorcentaje }
      const response = await fetch(
        mode === 'create' ? '/api/presupuestos-v2' : `/api/presupuestos-v2/${initialData?.id}`,
        { method: mode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Error al guardar') }
      const data = await response.json().catch(() => null)
      const id = mode === 'create' ? data?.id : initialData?.id
      // Resetear dirty ANTES del push para que el hook no intercepte la navegación
      setDirty(false)
      if (opts?.preview && id) {
        // Camino B: guarda y abre el PDF real en una pestaña nueva, luego lleva al detalle
        window.open(`/presupuestos/${id}/imprimir`, '_blank', 'noopener')
        router.push(`/presupuestos/${id}`)
      } else {
        router.push(mode === 'create' ? '/presupuestos?msg=creado' : '/presupuestos?msg=actualizado')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar')
    } finally { setLoading(false) }
  }

  // ── Render capitulo (shared) ───────────────────────────────────────────────

  function renderCapitulo(cap: Capitulo, ci: number) {
    const capTotal = cap.partidas.reduce((a, p) => a + (p.esNota ? 0 : p.subtotal), 0)
    const isCollapsed = collapsed.has(ci)
    const pct = subtotalBase > 0 ? (capTotal / subtotalBase) * 100 : 0
    return (
      <div key={ci} className="border border-border rounded-lg overflow-hidden shadow-sm">
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
              {pct > 0 && <div className="text-xs text-muted-foreground">{pct.toFixed(1)}%</div>}
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => moveCapitulo(ci, -1)} disabled={ci === 0} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => moveCapitulo(ci, 1)} disabled={ci === capitulos.length - 1} className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => setApuSearchOpen(ci)} className="p-1 rounded hover:bg-primary/90 transition-colors" aria-label="Buscar en catálogo APU" title="Buscar en catálogo APU"><FileSpreadsheet className="w-3.5 h-3.5" /></button>
            <button onClick={() => removeCapitulo(ci)} className="p-1 rounded hover:bg-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Partidas */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead><tr className="bg-muted/40 border-b border-border">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-8">#</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-24">Código</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase w-20">Und</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-24">Cantidad</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-28">P. Unitario</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-28">Subtotal</th>
                  <th className="w-16" />
                </tr></thead>
                <tbody>
                  {cap.partidas.map((p, pi) => {
                    const apuKey = `${ci}-${pi}`
                    if (p.esNota) {
                      return (
                        <tr key={p._key ?? `idx-${ci}-${pi}`} className="border-b border-amber-200 bg-amber-50/60 hover:bg-amber-50 group">
                          <td className="px-2 py-1 text-center text-xs text-amber-700 select-none font-bold" title="Nota informativa">★</td>
                          <td colSpan={6} className="px-1 py-0.5">
                            <textarea
                              value={p.descripcion}
                              onChange={(e) => updatePartida(ci, pi, 'descripcion', e.target.value)}
                              placeholder="Nota informativa (no suma al total)... Enter para nueva línea."
                              rows={1}
                              ref={(el) => {
                                // Auto-resize: ajusta la altura al contenido para
                                // que se vean todas las líneas sin scroll interno.
                                if (el) {
                                  el.style.height = 'auto'
                                  el.style.height = `${el.scrollHeight}px`
                                }
                              }}
                              onInput={(e) => {
                                const el = e.currentTarget
                                el.style.height = 'auto'
                                el.style.height = `${el.scrollHeight}px`
                              }}
                              className="w-full px-2 py-1.5 text-sm italic text-amber-900 border border-transparent rounded focus:outline-none focus:border-amber-400 focus:bg-card focus:ring-1 focus:ring-amber-300 hover:border-amber-300 bg-transparent transition-colors resize-none leading-snug"
                            />
                          </td>
                          <td className="px-1 py-0.5">
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => movePartida(ci, pi, -1)} disabled={pi === 0} aria-label="Subir" title="Subir" className="p-1 rounded hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp className="w-3.5 h-3.5" /></button>
                              <button onClick={() => movePartida(ci, pi, 1)} disabled={pi === cap.partidas.length - 1} aria-label="Bajar" title="Bajar" className="p-1 rounded hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removePartida(ci, pi)} aria-label="Eliminar" title="Eliminar" className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <Fragment key={p._key ?? `idx-${ci}-${pi}`}>
                        <tr className="border-b border-border hover:bg-muted/40/50 group">
                          <td className="px-2 py-1 text-center text-xs text-muted-foreground select-none">{pi + 1}</td>
                          <td className="px-1 py-0.5">
                            <NumericCell value={0} onChange={() => {}} cellkey={cellKey(ci, pi, 'codigo')} onKeyDown={(e) => handleCellKeyDown(e, ci, pi, 0)}
                              step="1" className="hidden" />
                            <input type="text" value={p.codigo} onChange={(e) => updatePartida(ci, pi, 'codigo', e.target.value)}
                              data-cellkey={cellKey(ci, pi, 'codigo')}
                              onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); focusCell(ci, pi, TAB_FIELDS[1]) } }}
                              placeholder="APU-001" className="w-full px-2 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-card focus:ring-1 focus:ring-blue-300 hover:border-border bg-transparent transition-colors" />
                          </td>
                          <td className="px-1 py-0.5">
                            <input type="text" value={p.descripcion} onChange={(e) => updatePartida(ci, pi, 'descripcion', e.target.value)}
                              data-cellkey={cellKey(ci, pi, 'descripcion')}
                              onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); focusCell(ci, pi, TAB_FIELDS[2]) } }}
                              placeholder="Descripción de la partida..." className="w-full px-2 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-card focus:ring-1 focus:ring-blue-300 hover:border-border bg-transparent transition-colors" />
                          </td>
                          <td className="px-1 py-0.5">
                            <select value={p.unidad} onChange={(e) => updatePartida(ci, pi, 'unidad', e.target.value)}
                              data-cellkey={cellKey(ci, pi, 'unidad')}
                              className="w-full px-1 py-1.5 text-sm border border-transparent rounded focus:outline-none focus:border-blue-400 focus:bg-card hover:border-border bg-transparent text-center transition-colors">
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
                          <td className="px-2 py-1 text-right text-sm font-bold text-foreground whitespace-nowrap">
                            {p.subtotal > 0 ? formatCurrency(p.subtotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
                          </td>
                          <td className="px-1 py-0.5">
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => movePartida(ci, pi, -1)} disabled={pi === 0} aria-label="Subir" title="Subir" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp className="w-3.5 h-3.5" /></button>
                              <button onClick={() => movePartida(ci, pi, 1)} disabled={pi === cap.partidas.length - 1} aria-label="Bajar" title="Bajar" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown className="w-3.5 h-3.5" /></button>
                              <button onClick={() => toggleApu(apuKey)} aria-label="APU" title="APU" className={`p-1 rounded transition-colors ${apuOpen === apuKey ? 'bg-blue-100 text-blue-600' : 'hover:bg-muted text-muted-foreground hover:text-primary'}`}><BarChart2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => duplicatePartida(ci, pi)} aria-label="Duplicar" title="Duplicar" className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removePartida(ci, pi)} aria-label="Eliminar" title="Eliminar" className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  <tr className="bg-muted/40 border-t border-border">
                    <td colSpan={6} className="px-3 py-2 text-xs text-muted-foreground text-right">Subtotal {cap.nombre}</td>
                    <td className="px-2 py-2 text-right text-sm font-bold text-foreground">{formatCurrency(capTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Add partida / APU search / nota */}
            <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-t border-border">
              <button onClick={() => addPartida(ci)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar partida
              </button>
              <button onClick={() => addNota(ci)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors" title="Agrega una línea informativa que no suma al total">
                <Plus className="w-3.5 h-3.5" /> Agregar nota
              </button>
              <button onClick={() => setApuSearchOpen(ci)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
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
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Cliente <span className="text-red-500">*</span></label>
              <select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setProyectoId('') }} className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card">
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Proyecto</label>
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} disabled={!clienteId} className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card disabled:opacity-50">
                <option value="">Sin proyecto</option>
                {filteredProyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas / Observaciones</label>
              <button
                type="button"
                onClick={() => setShowQuickTextPicker(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="w-3 h-3" /> Plantillas
              </button>
            </div>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Condiciones del presupuesto, alcances, notas para el cliente..."
              rows={3}
              className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg px-4 py-3">
        {/* Add Titulo */}
        <div className="flex items-center gap-1.5 mr-2">
          <Layers className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">+ Título:</span>
        </div>
        <button onClick={() => addTitulo()} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors"><Plus className="w-3 h-3" /> Vacío</button>
        {TITLE_TEMPLATES.map(t => (
          <button key={t} onClick={() => addTitulo(t)} className="px-2.5 py-1 text-xs font-medium rounded border border-border text-muted-foreground hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors truncate max-w-[140px]">{t}</button>
        ))}

        <div className="w-px h-4 bg-muted mx-1" />

        {/* Add Capitulo */}
        <div className="flex items-center gap-1.5 mr-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">+ Cap:</span>
        </div>
        <button onClick={() => addCapitulo(null)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"><Plus className="w-3 h-3" /> Vacío</button>
        {CHAPTER_TEMPLATES.map(t => (
          <button key={t.codigo} onClick={() => addCapituloFromTemplate(t, null)} className="px-2.5 py-1 text-xs font-medium rounded border border-border text-muted-foreground hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors">{t.codigo}·{t.nombre}</button>
        ))}

        <div className="w-px h-4 bg-muted mx-1" />

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
        <p className="text-xs text-muted-foreground px-1">
          Navega con <kbd className="bg-muted border border-border rounded px-1 py-0.5 text-xs font-mono">Tab</kbd> · <kbd className="bg-muted border border-border rounded px-1 py-0.5 text-xs font-mono">Enter</kbd> siguiente fila · Cantidades admiten hasta 4 decimales (ej: 0.0025)
        </p>
      )}

      {/* Empty state */}
      {capitulos.length === 0 && titulos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-xl bg-muted/40">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3"><Plus className="w-7 h-7 text-muted-foreground" /></div>
          <p className="text-lg font-semibold text-muted-foreground mb-1">Agrega tu primer título o capítulo</p>
          <p className="text-sm text-muted-foreground mb-5">Usa la barra de arriba para agregar títulos (grupos) y capítulos</p>
        </div>
      )}

      {/* ── TÍTULOS con sus capítulos ── */}
      {titulos.map((titulo, ti) => {
        const capsInTitulo = chaptersByTitulo[ti] || []
        const tituloTotal = capsInTitulo.reduce((s, { cap }) => s + cap.partidas.reduce((a, p) => a + (p.esNota ? 0 : p.subtotal), 0), 0)
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
                    Sin capítulos. Usa &ldquo;+ Cap.&rdquo; para agregar uno aquí, o asigna un capítulo existente a este título.
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
            <p className="text-xs text-muted-foreground font-medium px-1">Capítulos sin título asignado:</p>
          )}
          {floatingChapters.map(({ cap, ci }) => renderCapitulo(cap, ci))}
        </div>
      )}

      {/* ══ GASTOS INDIRECTOS ══ */}
      <div className="border-2 border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-700 text-white">
          <button onClick={() => setShowIndirecto(p => !p)} className="p-0.5 rounded hover:bg-slate-600 transition-colors flex-shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform ${showIndirecto ? 'rotate-90' : ''}`} />
          </button>
          <Percent className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
          <span className="flex-1 text-sm font-bold uppercase tracking-wide">Gastos Indirectos</span>
          <div className="text-right text-sm flex-shrink-0">
            <span className="text-muted-foreground text-xs mr-2">Base: {formatCurrency(subtotalBase)}</span>
            <span className="font-bold">{formatCurrency(subtotalIndirecto)}</span>
          </div>
        </div>

        {showIndirecto && (
          <div className="bg-muted/40 p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Cada línea se calcula automáticamente sobre el subtotal de las partidas normales ({formatCurrency(subtotalBase)}).
            </p>
            <table className="w-full">
              <thead><tr className="border-b border-border">
                <th className="text-left pb-2 text-xs font-semibold text-muted-foreground uppercase">Concepto</th>
                <th className="text-right pb-2 text-xs font-semibold text-muted-foreground uppercase w-24">% sobre base</th>
                <th className="text-right pb-2 text-xs font-semibold text-muted-foreground uppercase w-32">Monto calculado</th>
                <th className="pb-2 w-16" />
              </tr></thead>
              <tbody className="divide-y divide-border">
                {indirectoLineas.map((linea, li) => {
                  const monto = subtotalBase * linea.porcentaje / 100
                  return (
                    <tr key={li} className={`${linea.activo ? '' : 'opacity-40'}`}>
                      <td className="py-2 pr-3">
                        <input type="text" value={linea.nombre} onChange={e => updateIndirectoLinea(li, 'nombre', e.target.value)}
                          className="w-full text-sm text-foreground bg-transparent border border-transparent rounded px-2 py-0.5 focus:outline-none focus:border-border focus:bg-card hover:border-border" />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <input type="number" value={linea.porcentaje} step="0.5" min="0" max="100"
                            onChange={e => updateIndirectoLinea(li, 'porcentaje', parseFloat(e.target.value) || 0)}
                            className="w-16 text-right text-sm text-foreground bg-card border border-border rounded px-2 py-0.5 focus:outline-none focus:border-blue-400" />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-sm font-semibold text-foreground tabular-nums">{formatCurrency(monto)}</td>
                      <td className="py-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <button onClick={() => updateIndirectoLinea(li, 'activo', !linea.activo)} className={`p-1 rounded transition-colors ${linea.activo ? 'text-green-500 hover:bg-green-50' : 'text-muted-foreground/70 hover:bg-muted'}`} title={linea.activo ? 'Desactivar' : 'Activar'}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeIndirectoLinea(li)} className="p-1 rounded text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={2} className="pt-3 text-sm font-bold text-foreground text-right pr-3">Total Gastos Indirectos</td>
                  <td className="pt-3 text-right text-sm font-bold text-foreground tabular-nums">{formatCurrency(subtotalIndirecto)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <button onClick={addIndirectoLinea} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>
        )}
      </div>

      {/* ── Descuento + ITBIS ── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Descuento */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descuento</label>
            <div className="flex items-center gap-2">
              <select value={descuentoTipo} onChange={(e) => { setDescuentoTipo(e.target.value); if (e.target.value === 'ninguno') setDescuentoValor(0) }}
                className="px-2 py-1.5 text-sm border border-border rounded-lg bg-background">
                <option value="ninguno">Sin descuento</option>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="fijo">Monto fijo (RD$)</option>
              </select>
              {descuentoTipo !== 'ninguno' && (
                <div className="flex items-center gap-1">
                  <input type="number" min="0" step="0.01" value={descuentoValor || ''} onChange={(e) => setDescuentoValor(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg bg-background text-right tabular-nums" />
                  <span className="text-sm text-muted-foreground">{descuentoTipo === 'porcentaje' ? '%' : 'RD$'}</span>
                </div>
              )}
              {montoDescuento > 0 && (
                <span className="text-sm font-semibold text-red-500">-{formatCurrency(montoDescuento)}</span>
              )}
            </div>
          </div>

          {/* ITBIS */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ITBIS</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itbisActivo} onChange={(e) => setItbisActivo(e.target.checked)}
                  className="rounded border-border" />
                <span className="text-sm text-foreground">Aplicar ITBIS</span>
              </label>
              {itbisActivo && (
                <>
                  <select value={itbisPorcentaje} onChange={(e) => setItbisPorcentaje(parseFloat(e.target.value))}
                    className="px-2 py-1.5 text-sm border border-border rounded-lg bg-background">
                    <option value={18}>18% — Normal</option>
                    <option value={1.8}>1.8% — Norma 07-07</option>
                  </select>
                  <span className="text-sm font-semibold text-blue-600">+{formatCurrency(montoItbis)}</span>
                </>
              )}
            </div>
            {itbisActivo && itbisPorcentaje === 1.8 && (
              <p className="text-2xs text-muted-foreground">Norma 07-07 DGII: retención reducida al 1.8%</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Grand Total + Save ── */}
      <div className="sticky bottom-4 z-10">
        <div className="bg-card border border-border rounded-xl shadow-lg px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Subtotal Partidas</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(subtotalBase)}</p>
            </div>
            {subtotalIndirecto > 0 && (
              <>
                <div className="text-muted-foreground/70">+</div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Indirectos</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(subtotalIndirecto)}</p>
                </div>
              </>
            )}
            {montoDescuento > 0 && (
              <>
                <div className="text-muted-foreground/70">−</div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Descuento</p>
                  <p className="text-lg font-bold text-red-500">{formatCurrency(montoDescuento)}</p>
                </div>
              </>
            )}
            {montoItbis > 0 && (
              <>
                <div className="text-muted-foreground/70">+</div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">ITBIS {itbisPorcentaje}%</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(montoItbis)}</p>
                </div>
              </>
            )}
            <div className="text-muted-foreground/70">=</div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total General</p>
              <p className="text-2xl font-black text-foreground">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => handleSave({ preview: true })} disabled={loading} size="lg" variant="secondary" className="gap-2">
              <FileText className="w-4 h-4" />
              Guardar y ver PDF
            </Button>
            <Button onClick={() => handleSave()} disabled={loading} size="lg" className="gap-2">
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : mode === 'create' ? 'Crear cotización' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>

      {showImportModal && (
        <ImportarExcelModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
        />
      )}

      {showQuickTextPicker && (
        <QuickTextPicker
          currentText={notas}
          onInsert={(texto) => {
            setNotas(prev => prev.trim() ? `${prev}\n\n${texto}` : texto)
          }}
          onClose={() => setShowQuickTextPicker(false)}
        />
      )}
    </div>
  )
}
