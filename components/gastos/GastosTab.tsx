'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Plus, Upload, Search, Filter, Paperclip, Pencil, Trash2,
  TrendingDown, DollarSign, Receipt, AlertTriangle, CheckCircle, Tag,
  Columns,
} from 'lucide-react'
import { GastoForm, type GastoData } from './GastoForm'
import { ImportarGastosModal } from './ImportarGastosModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Gasto {
  id: number
  fecha: string
  tipoGasto: string
  referencia: string | null
  descripcion: string
  suplidor: string | null
  categoria: string | null
  subcategoria: string | null
  monto: number
  moneda: string
  metodoPago: string
  cuentaOrigen: string | null
  observaciones: string | null
  estado: string
  archivoUrl: string | null
  createdAt: string
  partidaId: number | null
  partida: { id: number; descripcion: string; codigo: string | null } | null
}

interface PartidaOption {
  id: number
  descripcion: string
  codigo: string | null
  capituloNombre: string | null
  subtotalPresupuestado: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, string> = {
  'Factura': 'bg-blue-100 text-blue-700',
  'Gasto menor': 'bg-muted text-muted-foreground',
  'Transferencia': 'bg-purple-100 text-purple-700',
  'Caja chica': 'bg-amber-100 text-amber-700',
  'Compra de materiales': 'bg-orange-100 text-orange-700',
  'Mano de obra': 'bg-green-100 text-green-700',
  'Transporte': 'bg-cyan-100 text-cyan-700',
  'Subcontrato': 'bg-indigo-100 text-indigo-700',
  'Servicio': 'bg-teal-100 text-teal-700',
  'Otro': 'bg-muted text-muted-foreground',
}

const ESTADO_COLORS: Record<string, string> = {
  'Registrado': 'bg-blue-100 text-blue-700',
  'Revisado': 'bg-green-100 text-green-700',
  'Anulado': 'bg-red-100 text-red-500 line-through',
}

const TIPOS_GASTO = ['Factura', 'Gasto menor', 'Transferencia', 'Caja chica', 'Compra de materiales', 'Mano de obra', 'Transporte', 'Subcontrato', 'Servicio', 'Otro']
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Caja chica', 'Otro']
const ESTADOS = ['Registrado', 'Revisado', 'Anulado']

// ── Column visibility ─────────────────────────────────────────────────────────

const COL_LABELS: Record<string, string> = {
  fecha:     'Fecha',
  tipo:      'Tipo',
  referencia:'Ref.',
  descripcion:'Descripción',
  suplidor:  'Suplidor',
  categoria: 'Categoría',
  pago:      'Método pago',
  partida:   'Partida presupuestaria',
  monto:     'Monto',
  estado:    'Estado',
  adjunto:   'Adjunto',
}

const DEFAULT_COLS: Record<string, boolean> = {
  fecha: true, tipo: true, referencia: true, descripcion: true,
  suplidor: true, categoria: true, pago: true, partida: true,
  monto: true, estado: true, adjunto: false,
}

const ALWAYS_VISIBLE = new Set(['descripcion', 'monto'])
const LS_KEY = 'gastos_cols_v1'

function loadCols(): Record<string, boolean> {
  try {
    const s = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    return s ? { ...DEFAULT_COLS, ...JSON.parse(s) } : { ...DEFAULT_COLS }
  } catch { return { ...DEFAULT_COLS } }
}

// ── PartidaCell ───────────────────────────────────────────────────────────────

function PartidaCell({ gasto, partidas, proyectoId, onUpdated }: {
  gasto: Gasto
  partidas: PartidaOption[]
  proyectoId: number
  onUpdated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function assign(partidaId: number | null) {
    setSaving(true)
    setOpen(false)
    try {
      await fetch(`/api/proyectos/${proyectoId}/gastos/${gasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partidaId }),
      })
      setSaved(true)
      onUpdated()
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  const filteredPartidas = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return partidas
    return partidas.filter(p =>
      p.descripcion.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      p.capituloNombre?.toLowerCase().includes(q)
    )
  }, [partidas, search])

  const label = gasto.partida
    ? `${gasto.partida.codigo ? `[${gasto.partida.codigo}] ` : ''}${gasto.partida.descripcion}`
    : null

  if (partidas.length === 0) {
    return <span className="text-xs text-muted-foreground/70 italic">Sin presupuesto</span>
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(v => !v); setSearch('') }}
        disabled={saving}
        title={label ?? 'Sin asignar — clic para asignar'}
        className={`text-xs px-2 py-1 rounded border transition-colors text-left w-full max-w-[180px] block truncate ${
          saved    ? 'border-green-300 bg-green-50 text-green-700' :
          saving   ? 'border-border bg-muted/40 text-muted-foreground cursor-wait' :
          label    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' :
                     'border-dashed border-border text-muted-foreground hover:border-blue-300 hover:text-blue-500'
        }`}
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : label ?? '+ Asignar partida'}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-xl z-50">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar partida…"
              className="w-full text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {gasto.partida && (
              <button
                onClick={() => assign(null)}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-b border-border"
              >
                ✕ Quitar asignación
              </button>
            )}
            {filteredPartidas.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">Sin resultados</div>
            ) : (
              filteredPartidas.map(p => (
                <button
                  key={p.id}
                  onClick={() => assign(p.id)}
                  className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 transition-colors ${
                    gasto.partidaId === p.id ? 'bg-blue-50 text-blue-700' : 'text-foreground'
                  }`}
                >
                  <div className="text-xs font-medium truncate">
                    {p.codigo && <span className="text-muted-foreground mr-1">[{p.codigo}]</span>}
                    {p.descripcion}
                  </div>
                  {p.capituloNombre && (
                    <div className="text-xs text-muted-foreground truncate">{p.capituloNombre}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ColumnPicker ──────────────────────────────────────────────────────────────

function ColumnPicker({ cols, onChange }: {
  cols: Record<string, boolean>
  onChange: (c: Record<string, boolean>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen(v => !v)}>
        <Columns className="w-3.5 h-3.5" /> Columnas
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-lg shadow-xl z-40 py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-0.5">
            Columnas visibles
          </div>
          {Object.keys(COL_LABELS).map(key => {
            const always = ALWAYS_VISIBLE.has(key)
            return (
              <label
                key={key}
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-muted select-none ${always ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={cols[key] ?? true}
                  disabled={always}
                  onChange={e => onChange({ ...cols, [key]: e.target.checked })}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-xs text-foreground">{COL_LABELS[key]}</span>
                {always && <span className="text-xs text-muted-foreground/70 ml-auto">fija</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── GastosTab ─────────────────────────────────────────────────────────────────

export function GastosTab({
  proyectoId,
  presupuestoEstimado,
}: {
  proyectoId: number
  presupuestoEstimado?: number | null
}) {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [partidas, setPartidas] = useState<PartidaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGasto, setEditGasto] = useState<GastoData | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [cols, setCols] = useState<Record<string, boolean>>(DEFAULT_COLS)

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
    if (!window.confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return
    await fetch(`/api/proyectos/${proyectoId}/gastos/${id}`, { method: 'DELETE' })
    loadGastos()
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
    if (!window.confirm('¿Anular este gasto?')) return
    await fetch(`/api/proyectos/${proyectoId}/gastos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Anulado' }),
    })
    loadGastos()
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
            {filtroActivo && <span className="ml-1 w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center leading-none">{[search, filtroTipo, filtroMetodo, filtroEstado, filtroCategoria, filtroPartida, filtroDesde, filtroHasta].filter(Boolean).length}</span>}
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
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-blue-50 rounded transition-colors" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {g.estado !== 'Anulado' && (
                            <button onClick={() => handleAnular(g.id)}
                              className="p-1.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Anular">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(g.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
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
    </div>
  )
}
