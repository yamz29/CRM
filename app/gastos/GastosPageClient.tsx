'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GastoForm, type GastoData } from '@/components/gastos/GastoForm'
import { Plus, Search, Pencil, Trash2, Paperclip, Building2, Wrench, LayoutGrid, HelpCircle, FolderOpen, Receipt } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Gasto {
  id: number
  fecha: string
  tipoGasto: string
  referencia: string | null
  descripcion: string
  suplidor: string | null
  categoria: string | null
  monto: number
  moneda: string
  metodoPago: string
  estado: string
  archivoUrl: string | null
  destinoTipo: string
  proyectoId: number | null
  proyecto: { id: number; nombre: string } | null
  partida: { id: number; descripcion: string; codigo: string | null } | null
}

interface Props {
  gastosIniciales: Gasto[]
  proyectos: { id: number; nombre: string }[]
  totalInicial: number
  porDestinoInicial: Record<string, number>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DESTINO_CONFIG: Record<string, { label: string; color: string; darkColor: string; icon: React.ReactNode }> = {
  proyecto:    { label: 'Proyecto',    color: 'bg-blue-100 text-blue-700',   darkColor: 'dark:bg-blue-900/30 dark:text-blue-400',   icon: <FolderOpen className="w-3 h-3" /> },
  oficina:     { label: 'Oficina',     color: 'bg-green-100 text-green-700', darkColor: 'dark:bg-green-900/30 dark:text-green-400', icon: <Building2 className="w-3 h-3" /> },
  taller:      { label: 'Taller',      color: 'bg-orange-100 text-orange-700', darkColor: 'dark:bg-orange-900/30 dark:text-orange-400', icon: <Wrench className="w-3 h-3" /> },
  general:     { label: 'General',     color: 'bg-slate-100 text-slate-600', darkColor: 'dark:bg-slate-800 dark:text-slate-300',   icon: <LayoutGrid className="w-3 h-3" /> },
  sin_asignar: { label: 'Sin asignar', color: 'bg-yellow-100 text-yellow-700', darkColor: 'dark:bg-yellow-900/30 dark:text-yellow-400', icon: <HelpCircle className="w-3 h-3" /> },
}

const ESTADO_COLORS: Record<string, string> = {
  Registrado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Revisado:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Anulado:    'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400',
}

function DestinoBadge({ destino, proyecto }: { destino: string; proyecto?: { nombre: string } | null }) {
  const cfg = DESTINO_CONFIG[destino] ?? DESTINO_CONFIG.sin_asignar
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.darkColor}`}>
      {cfg.icon}
      {destino === 'proyecto' && proyecto ? proyecto.nombre : cfg.label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GastosPageClient({ gastosIniciales, proyectos, totalInicial, porDestinoInicial }: Props) {
  const [gastos, setGastos]         = useState<Gasto[]>(gastosIniciales)
  const [total, setTotal]           = useState(totalInicial)
  const [porDestino, setPorDestino] = useState(porDestinoInicial)
  const [formOpen, setFormOpen]     = useState(false)
  const [editing, setEditing]       = useState<GastoData | null>(null)
  const [deleting, setDeleting]     = useState<number | null>(null)

  // Filters
  const [q, setQ]                           = useState('')
  const [filtroDestino, setFiltroDestino]   = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')

  const filtered = useMemo(() => {
    return gastos.filter(g => {
      if (filtroDestino  && g.destinoTipo !== filtroDestino) return false
      if (filtroProyecto && String(g.proyectoId) !== filtroProyecto) return false
      if (filtroEstado   && g.estado !== filtroEstado) return false
      if (q) {
        const lq = q.toLowerCase()
        if (
          !g.descripcion.toLowerCase().includes(lq) &&
          !(g.suplidor?.toLowerCase().includes(lq)) &&
          !(g.referencia?.toLowerCase().includes(lq)) &&
          !(g.categoria?.toLowerCase().includes(lq))
        ) return false
      }
      return true
    })
  }, [gastos, q, filtroDestino, filtroProyecto, filtroEstado])

  async function reload() {
    const res = await fetch('/api/gastos')
    if (!res.ok) return
    const data = await res.json()
    setGastos(data.gastos)
    setTotal(data.total)
    setPorDestino(data.porDestino)
  }

  function openNew() { setEditing(null); setFormOpen(true) }
  function openEdit(g: Gasto) {
    setEditing({
      id: g.id,
      fecha: g.fecha.split('T')[0],
      tipoGasto: g.tipoGasto,
      referencia: g.referencia ?? '',
      descripcion: g.descripcion,
      suplidor: g.suplidor ?? '',
      categoria: g.categoria ?? '',
      subcategoria: '',
      monto: String(g.monto),
      moneda: g.moneda,
      metodoPago: g.metodoPago,
      cuentaOrigen: '',
      observaciones: '',
      estado: g.estado,
      archivoUrl: g.archivoUrl,
      destinoTipo: g.destinoTipo,
      proyectoIdSeleccionado: g.proyectoId,
      partidaId: g.partida?.id ?? null,
    })
    setFormOpen(true)
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return
    setDeleting(id)
    await fetch(`/api/gastos/${id}`, { method: 'DELETE' })
    setDeleting(null)
    reload()
  }

  const totalFiltrado = filtered.reduce((s, g) => s + g.monto, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-6 h-6 text-muted-foreground" />
            Gastos
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Registro general de gastos operativos</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(DESTINO_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFiltroDestino(filtroDestino === key ? '' : key)}
            className={`rounded-xl border p-3 text-left transition-all ${
              filtroDestino === key
                ? 'ring-2 ring-primary border-primary/50 bg-card'
                : 'bg-card border-border hover:border-border/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.darkColor}`}>
                {cfg.icon}{cfg.label}
              </span>
            </div>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(porDestino[key] ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gastos.filter(g => g.destinoTipo === key).length} gastos
            </p>
          </button>
        ))}
      </div>

      {/* Total card */}
      <div className="bg-primary/10 border border-primary/20 rounded-xl px-5 py-3 flex items-center justify-between dark:bg-primary/5">
        <span className="text-muted-foreground text-sm font-medium">Total general</span>
        <span className="text-foreground text-2xl font-bold tabular-nums">{formatCurrency(total)}</span>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar descripción, suplidor, referencia..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select value={filtroDestino} onChange={e => setFiltroDestino(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los destinos</option>
          {Object.entries(DESTINO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtroProyecto} onChange={e => setFiltroProyecto(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los estados</option>
          {['Registrado', 'Revisado', 'Anulado'].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        {(q || filtroDestino || filtroProyecto || filtroEstado) && (
          <button onClick={() => { setQ(''); setFiltroDestino(''); setFiltroProyecto(''); setFiltroEstado('') }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">Limpiar</button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {gastos.length} · <span className="font-semibold text-foreground">{formatCurrency(totalFiltrado)}</span>
        </span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No hay gastos registrados{q || filtroDestino ? ' con esos filtros' : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Descripción</th>
                  <th className="px-4 py-2.5 text-left">Destino</th>
                  <th className="px-4 py-2.5 text-left">Tipo</th>
                  <th className="px-4 py-2.5 text-left">Suplidor</th>
                  <th className="px-4 py-2.5 text-right">Monto</th>
                  <th className="px-4 py-2.5 text-center">Estado</th>
                  <th className="px-4 py-2.5 text-center w-8"></th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(g => (
                  <tr key={g.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">{formatDate(g.fecha)}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{g.descripcion}</div>
                      {g.referencia && <div className="text-xs text-muted-foreground">{g.referencia}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <DestinoBadge destino={g.destinoTipo} proyecto={g.proyecto} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.tipoGasto}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.suplidor ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {g.moneda} {g.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[g.estado] ?? 'bg-muted text-muted-foreground'}`}>
                        {g.estado}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {g.archivoUrl && (
                        <a href={g.archivoUrl} target="_blank" rel="noopener noreferrer" title="Ver adjunto"
                          className="text-primary/60 hover:text-primary transition-colors">
                          <Paperclip className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(g)}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(g.id)} disabled={deleting === g.id}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GastoForm modal */}
      {formOpen && (
        <GastoForm
          proyectos={proyectos}
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={() => { setFormOpen(false); setEditing(null); reload() }}
        />
      )}
    </div>
  )
}
