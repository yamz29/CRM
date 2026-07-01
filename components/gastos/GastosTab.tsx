'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Plus, Upload, Search, Filter, Paperclip, Pencil, Trash2,
  TrendingDown, DollarSign, Receipt, AlertTriangle, CheckCircle, Tag,
  X,
} from 'lucide-react'
import { GastoForm, type GastoData } from './GastoForm'
import { ImportarGastosModal } from './ImportarGastosModal'

// Tipos, constantes y sub-componentes viven en archivos aparte (#H26).
import {
  type Gasto, type PartidaOption,
  TIPO_COLORS, ESTADO_COLORS, TIPOS_GASTO, METODOS_PAGO, ESTADOS,
  DEFAULT_COLS, loadCols, LS_KEY,
} from './tipos'
import { PartidaCell } from './PartidaCell'
import { ColumnPicker } from './ColumnPicker'

// ── GastosTab ─────────────────────────────────────────────────────────────────

export function GastosTab({
  proyectoId,
  presupuestoEstimado,
}: {
  proyectoId: number
  presupuestoEstimado?: number | null
}) {
  const toast = useToast()
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [partidas, setPartidas] = useState<PartidaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGasto, setEditGasto] = useState<GastoData | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [cols, setCols] = useState<Record<string, boolean>>(DEFAULT_COLS)
  const [confirmacion, setConfirmacion] = useState<{ tipo: 'eliminar' | 'anular'; gastoId: number } | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkPartidaId, setBulkPartidaId] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroPartida, setFiltroPartida] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Load column prefs from localStorage after mount
  useEffect(() => { setCols(loadCols()) }, [])

  // Indeterminate state for select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length
    }
  })

  async function loadGastos() {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos`)
      const data = await res.json()
      setGastos(data.gastos ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGastos()
    fetch(`/api/proyectos/${proyectoId}/partidas`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPartidas(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [proyectoId])

  function updateCols(next: Record<string, boolean>) {
    setCols(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
  }

  // Derived stats
  const gastosActivos = gastos.filter(g => g.estado !== 'Anulado')
  const totalGastado = gastosActivos.reduce((s, g) => s + g.monto, 0)
  const balance = presupuestoEstimado != null ? presupuestoEstimado - totalGastado : null
  const gastosConPartida = gastosActivos.filter(g => g.partidaId != null).length
  const gastosSinPartida = gastosActivos.length - gastosConPartida
  const pctClasificado = gastosActivos.length > 0 ? Math.round((gastosConPartida / gastosActivos.length) * 100) : 0

  const categorias = useMemo(() => {
    const set = new Set(gastos.map(g => g.categoria).filter(Boolean) as string[])
    return [...set].sort()
  }, [gastos])

  const filtered = useMemo(() => {
    return gastos.filter(g => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !g.descripcion.toLowerCase().includes(q) &&
          !g.referencia?.toLowerCase().includes(q) &&
          !g.suplidor?.toLowerCase().includes(q) &&
          !g.categoria?.toLowerCase().includes(q) &&
          !g.tipoGasto.toLowerCase().includes(q)
        ) return false
      }
      if (filtroTipo && g.tipoGasto !== filtroTipo) return false
      if (filtroMetodo && g.metodoPago !== filtroMetodo) return false
      if (filtroEstado && g.estado !== filtroEstado) return false
      if (filtroCategoria && g.categoria !== filtroCategoria) return false
      if (filtroDesde && new Date(g.fecha) < new Date(filtroDesde)) return false
      if (filtroHasta && new Date(g.fecha) > new Date(filtroHasta + 'T23:59:59')) return false
      if (filtroPartida === 'sin_asignar') { if (g.partidaId != null) return false }
      else if (filtroPartida) { if (String(g.partidaId) !== filtroPartida) return false }
      return true
    })
  }, [gastos, search, filtroTipo, filtroMetodo, filtroEstado, filtroCategoria, filtroDesde, filtroHasta, filtroPartida])

  const filtroActivo = !!(search || filtroTipo || filtroMetodo || filtroEstado || filtroCategoria || filtroDesde || filtroHasta || filtroPartida)

  function clearFilters() {
    setSearch(''); setFiltroTipo(''); setFiltroMetodo('')
    setFiltroEstado(''); setFiltroCategoria(''); setFiltroDesde(''); setFiltroHasta('')
    setFiltroPartida('')
    setSelectedIds(new Set())
  }

  async function handleDelete(id: number) {
    setConfirmando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.exito('Gasto eliminado')
        loadGastos()
      } else {
        toast.error('Error al eliminar el gasto')
      }
    } finally {
      setConfirmando(false)
      setConfirmacion(null)
    }
  }

  async function handleBulkAssign() {
    if (!bulkPartidaId || selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.all([...selectedIds].map(id =>
        fetch(`/api/proyectos/${proyectoId}/gastos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partidaId: parseInt(bulkPartidaId) }),
        })
      ))
      setSelectedIds(new Set())
      setBulkPartidaId('')
      loadGastos()
    } finally {
      setBulkLoading(false)
    }
  }

  async function handleAnular(id: number) {
    setConfirmando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/gastos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Anulado' }),
      })
      if (res.ok) {
        toast.exito('Gasto anulado')
        loadGastos()
      } else {
        toast.error('Error al anular el gasto')
      }
    } finally {
      setConfirmando(false)
      setConfirmacion(null)
    }
  }

  function startEdit(g: Gasto) {
    setEditGasto({
      id: g.id,
      fecha: g.fecha.split('T')[0],
      tipoGasto: g.tipoGasto,
      referencia: g.referencia ?? '',
      descripcion: g.descripcion,
      suplidor: g.suplidor ?? '',
      categoria: g.categoria ?? '',
      subcategoria: g.subcategoria ?? '',
      monto: String(g.monto),
      moneda: g.moneda,
      metodoPago: g.metodoPago,
      cuentaOrigen: g.cuentaOrigen ?? '',
      observaciones: g.observaciones ?? '',
      estado: g.estado,
      archivoUrl: g.archivoUrl,
      partidaId: g.partidaId,
    })
    setShowForm(true)
  }

  const col = (key: string) => cols[key] ?? true

  return (
    <div className="space-y-4">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total gastado</span>
          </div>
          <p className="text-xl font-black text-foreground">{formatCurrency(totalGastado)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{gastosActivos.length} gastos activos</p>
        </div>

        {presupuestoEstimado != null && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Presupuestado</span>
            </div>
            <p className="text-xl font-black text-foreground">{formatCurrency(presupuestoEstimado)}</p>
          </div>
        )}

        {balance != null && (
          <div className={`border rounded-xl p-4 ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {balance >= 0
                ? <Receipt className="w-4 h-4 text-green-600" />
                : <AlertTriangle className="w-4 h-4 text-red-500" />}
              <span className={`text-xs font-semibold uppercase tracking-wide ${balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {balance >= 0 ? 'Disponible' : 'Sobregirado'}
              </span>
            </div>
            <p className={`text-xl font-black ${balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(balance))}
            </p>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total registros</span>
          </div>
          <p className="text-xl font-black text-foreground">{gastos.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{gastos.filter(g => g.estado === 'Anulado').length} anulados</p>
        </div>
      </div>

      {/* ── Classification summary bar ── */}
      {gastosActivos.length > 0 && (
        <div className="bg-card border border-border rounded-xl px-4 py-2.5 flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clasificación</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-foreground"><span className="font-bold">{gastosConPartida}</span> asignados</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-border inline-block flex-shrink-0" />
            <span className="text-xs text-muted-foreground"><span className="font-bold">{gastosSinPartida}</span> sin asignar</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-1.5 w-28 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctClasificado === 100 ? 'bg-green-500' : pctClasificado > 0 ? 'bg-blue-500' : 'bg-muted'}`}
                style={{ width: `${pctClasificado}%` }}
              />
            </div>
            <span className="text-xs font-bold text-foreground">{pctClasificado}%</span>
          </div>
          {gastosSinPartida > 0 && partidas.length > 0 && (
            <button
              onClick={() => { setFiltroPartida('sin_asignar'); setShowFilters(true) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver sin asignar →
            </button>
          )}
        </div>
      )}

      {/* ── Actions bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar descripción, suplidor, ref..."
              className="pl-9 h-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className={filtroActivo ? 'border-blue-400 text-blue-600 bg-blue-50' : ''}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {filtroActivo && <span className="ml-1 w-4 h-4 rounded-full bg-primary text-white text-xs flex items-center justify-center leading-none">{[search, filtroTipo, filtroMetodo, filtroEstado, filtroCategoria, filtroPartida, filtroDesde, filtroHasta].filter(Boolean).length}</span>}
          </Button>
          {filtroActivo && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-muted-foreground">Limpiar</button>
          )}
        </div>
        <div className="flex gap-2">
          <ColumnPicker cols={cols} onChange={updateCols} />
          <Button size="sm" variant="secondary" onClick={() => setShowImport(true)}>
            <Upload className="w-3.5 h-3.5" /> Importar
          </Button>
          <Button size="sm" onClick={() => { setEditGasto(null); setShowForm(true) }}>
            <Plus className="w-3.5 h-3.5" /> Nuevo gasto
          </Button>
        </div>
      </div>

      {/* ── Chips de filtros activos (siempre visibles, #H28) ── */}
      {filtroActivo && (
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            search && { label: `"${search}"`, clear: () => setSearch('') },
            filtroTipo && { label: `Tipo: ${filtroTipo}`, clear: () => setFiltroTipo('') },
            filtroMetodo && { label: `Método: ${filtroMetodo}`, clear: () => setFiltroMetodo('') },
            filtroEstado && { label: `Estado: ${filtroEstado}`, clear: () => setFiltroEstado('') },
            filtroCategoria && { label: `Cat: ${filtroCategoria}`, clear: () => setFiltroCategoria('') },
            filtroDesde && { label: `Desde ${filtroDesde}`, clear: () => setFiltroDesde('') },
            filtroHasta && { label: `Hasta ${filtroHasta}`, clear: () => setFiltroHasta('') },
            filtroPartida && { label: 'Partida asignada', clear: () => setFiltroPartida('') },
          ].filter(Boolean) as { label: string; clear: () => void }[]).map((c, i) => (
            <button
              key={i}
              onClick={c.clear}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {c.label} <X className="w-3 h-3" />
            </button>
          ))}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground ml-1">Limpiar todo</button>
        </div>
      )}

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="bg-muted/40 border border-border rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo de gasto</label>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                className="w-full h-8 text-xs border border-border rounded-md px-2 bg-card">
                <option value="">Todos</option>
                {TIPOS_GASTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Método de pago</label>
              <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}
                className="w-full h-8 text-xs border border-border rounded-md px-2 bg-card">
                <option value="">Todos</option>
                {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Estado</label>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                className="w-full h-8 text-xs border border-border rounded-md px-2 bg-card">
                <option value="">Todos</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {categorias.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Categoría</label>
                <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
                  className="w-full h-8 text-xs border border-border rounded-md px-2 bg-card">
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {partidas.length > 0 && (
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Partida presupuestaria</label>
                <select value={filtroPartida} onChange={e => setFiltroPartida(e.target.value)}
                  className="w-full h-8 text-xs border border-border rounded-md px-2 bg-card">
                  <option value="">Todas las partidas</option>
                  <option value="sin_asignar">— Sin asignar</option>
                  {partidas.map(p => (
                    <option key={p.id} value={String(p.id)}>
                      {p.codigo ? `[${p.codigo}] ` : ''}{p.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Desde</label>
              <Input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Hasta</label>
              <Input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && partidas.length > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex-wrap">
          <span className="text-xs font-semibold text-blue-700">
            {selectedIds.size} {selectedIds.size === 1 ? 'gasto seleccionado' : 'gastos seleccionados'}
          </span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={bulkPartidaId}
              onChange={e => setBulkPartidaId(e.target.value)}
              className="h-8 text-xs border border-blue-200 rounded-md px-2 bg-card flex-1 max-w-xs"
            >
              <option value="">— Seleccionar partida —</option>
              {partidas.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.codigo ? `[${p.codigo}] ` : ''}{p.descripcion}
                </option>
              ))}
            </select>
            <Button size="sm" disabled={!bulkPartidaId || bulkLoading} onClick={handleBulkAssign}>
              {bulkLoading ? 'Asignando...' : 'Asignar partida'}
            </Button>
          </div>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkPartidaId('') }}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium ml-auto"
          >
            Cancelar selección
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando gastos...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <TrendingDown className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {filtroActivo ? 'No hay gastos que coincidan con los filtros.' : 'No hay gastos registrados aún.'}
            </p>
            {!filtroActivo && (
              <Button size="sm" className="mt-3" onClick={() => { setEditGasto(null); setShowForm(true) }}>
                <Plus className="w-3.5 h-3.5" /> Registrar primer gasto
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="pl-3 pr-1 py-2.5 w-8">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={e => setSelectedIds(e.target.checked ? new Set(filtered.map(g => g.id)) : new Set())}
                        className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                      />
                    </th>
                    {col('fecha')      && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Fecha</th>}
                    {col('tipo')       && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>}
                    {col('referencia') && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Ref.</th>}
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                    {col('suplidor')   && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Suplidor</th>}
                    {col('categoria')  && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Categoría</th>}
                    {col('pago')       && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Pago</th>}
                    {col('partida')    && <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Partida</th>}
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Monto</th>
                    {col('estado')     && <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase">Estado</th>}
                    {col('adjunto')    && <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase">Doc.</th>}
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Acc.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(g => (
                    <tr key={g.id} className={`hover:bg-muted/60 ${g.estado === 'Anulado' ? 'opacity-50' : ''} ${selectedIds.has(g.id) ? 'bg-blue-50/60' : ''}`}>
                      <td className="pl-3 pr-1 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(g.id)}
                          onChange={e => {
                            const next = new Set(selectedIds)
                            e.target.checked ? next.add(g.id) : next.delete(g.id)
                            setSelectedIds(next)
                          }}
                          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                        />
                      </td>
                      {col('fecha') && (
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(g.fecha)}</td>
                      )}
                      {col('tipo') && (
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[g.tipoGasto] ?? 'bg-muted text-muted-foreground'}`}>
                            {g.tipoGasto}
                          </span>
                        </td>
                      )}
                      {col('referencia') && (
                        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{g.referencia || '—'}</td>
                      )}
                      <td className="px-3 py-2 text-sm text-foreground max-w-[180px]">
                        <span className="truncate block" title={g.descripcion}>{g.descripcion}</span>
                        {g.observaciones && (
                          <span className="text-xs text-muted-foreground truncate block">{g.observaciones}</span>
                        )}
                      </td>
                      {col('suplidor') && (
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px]">
                          <span className="truncate block" title={g.suplidor ?? ''}>{g.suplidor || '—'}</span>
                        </td>
                      )}
                      {col('categoria') && (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {g.categoria || '—'}
                          {g.subcategoria && <span className="block text-muted-foreground">{g.subcategoria}</span>}
                        </td>
                      )}
                      {col('pago') && (
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{g.metodoPago}</td>
                      )}
                      {col('partida') && (
                        <td className="px-3 py-2">
                          <PartidaCell
                            gasto={g}
                            partidas={partidas}
                            proyectoId={proyectoId}
                            onUpdated={loadGastos}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 text-right text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
                        {g.moneda !== 'RD$' && <span className="text-xs text-muted-foreground mr-1">{g.moneda}</span>}
                        {formatCurrency(g.monto)}
                      </td>
                      {col('estado') && (
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLORS[g.estado] ?? 'bg-muted text-muted-foreground'}`}>
                            {g.estado}
                          </span>
                        </td>
                      )}
                      {col('adjunto') && (
                        <td className="px-3 py-2 text-center">
                          {g.archivoUrl
                            ? <a href={g.archivoUrl} target="_blank" rel="noopener noreferrer" title="Ver adjunto"
                                className="inline-flex items-center justify-center text-blue-500 hover:text-blue-700">
                                <Paperclip className="w-4 h-4" />
                              </a>
                            : <span className="text-muted-foreground/50">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => startEdit(g)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-blue-50 rounded transition-colors" aria-label="Editar" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {g.estado !== 'Anulado' && (
                            <button onClick={() => setConfirmacion({ tipo: 'anular', gastoId: g.id })}
                              className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" aria-label="Anular" title="Anular">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setConfirmacion({ tipo: 'eliminar', gastoId: g.id })}
                            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors" aria-label="Eliminar" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-muted/40 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
                {filtroActivo && gastos.length !== filtered.length && ` de ${gastos.length} total`}
              </span>
              <div className="text-right">
                <span className="text-xs text-muted-foreground mr-2">Total filtrado (activos):</span>
                <span className="text-sm font-black text-foreground tabular-nums">
                  {formatCurrency(filtered.filter(g => g.estado !== 'Anulado').reduce((s, g) => s + g.monto, 0))}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <GastoForm
          proyectoId={proyectoId}
          initial={editGasto}
          onClose={() => { setShowForm(false); setEditGasto(null) }}
          onSaved={loadGastos}
        />
      )}

      {showImport && (
        <ImportarGastosModal
          proyectoId={proyectoId}
          onClose={() => setShowImport(false)}
          onImported={loadGastos}
        />
      )}

      <ConfirmDialog
        abierto={confirmacion !== null}
        titulo={confirmacion?.tipo === 'anular' ? '¿Anular este gasto?' : '¿Eliminar este gasto?'}
        descripcion={confirmacion?.tipo === 'eliminar' ? 'Esta acción no se puede deshacer.' : undefined}
        textoConfirmar={confirmacion?.tipo === 'anular' ? 'Sí, anular' : 'Sí, eliminar'}
        variante="peligro"
        cargando={confirmando}
        onConfirmar={() => {
          if (!confirmacion) return
          if (confirmacion.tipo === 'anular') handleAnular(confirmacion.gastoId)
          else handleDelete(confirmacion.gastoId)
        }}
        onCancelar={() => setConfirmacion(null)}
      />
    </div>
  )
}
