'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/api-client'
import Link from 'next/link'
import { Plus, Search, Trash2, ArrowRightLeft, CheckCircle2, Upload, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import type { ClienteRef, FacturaLista, CuentaBancariaConSaldo, ResumenFacturas as Resumen } from '@/lib/types'

const ImportarExtractoModal = dynamic(() => import('@/components/contabilidad/ImportarExtractoModal').then(m => m.ImportarExtractoModal))
const ConvertirCreditoRecibo = dynamic(() => import('@/components/contabilidad/ConvertirCreditoRecibo').then(m => m.ConvertirCreditoRecibo))

// ── Conciliación Tab ─────────────────────────────────────────────────────

export function ConciliacionTab({ cuentas, clientes }: { cuentas: CuentaBancariaConSaldo[]; clientes: ClienteRef[] }) {
  const toast = useToast()
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id?.toString() || '')
  const queryClient = useQueryClient()
  // Movimientos de la cuenta seleccionada: la key incluye la cuenta, asi que
  // cambiar de cuenta recarga sola (antes habia que pulsar "Cargar").
  const { data: movimientos = [], isLoading: loading, refetch: fetchMovimientos } = useQuery({
    queryKey: ['contabilidad', 'movimientos', Number(cuentaId)],
    queryFn: () => fetchJson<any[]>(`/api/contabilidad/cuentas/${cuentaId}/movimientos`),
    enabled: !!cuentaId,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  // Facturas para conciliar: comparte cache con la tab Facturas (misma key)
  const { data: facturasDisponibles = [] } = useQuery({
    queryKey: ['contabilidad', 'facturas'],
    queryFn: () => fetchJson<{ facturas: FacturaLista[]; resumen: Resumen }>('/api/contabilidad/facturas'),
    select: (d) => d.facturas,
  })
  const [movimientoConvertir, setMovimientoConvertir] = useState<any | null>(null)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'sin' | 'conciliados'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'credito' | 'debito'>('todos')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')

  // Selección masiva
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [eliminando, setEliminando] = useState(false)

  // Confirmación genérica para reemplazar el diálogo nativo del navegador
  const [confirmacion, setConfirmacion] = useState<{
    titulo: string
    descripcion?: string
    textoConfirmar?: string
    onConfirmar: () => void
  } | null>(null)

  const movimientosFiltrados = movimientos.filter((m: any) => {
    if (filtroEstado === 'sin' && m.conciliado) return false
    if (filtroEstado === 'conciliados' && !m.conciliado) return false
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
    if (filtroDesde) {
      const f = new Date(m.fecha)
      const d = new Date(filtroDesde + 'T00:00:00')
      if (f < d) return false
    }
    if (filtroHasta) {
      const f = new Date(m.fecha)
      const h = new Date(filtroHasta + 'T23:59:59')
      if (f > h) return false
    }
    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase()
      const desc = (m.descripcion || '').toLowerCase()
      const ref = (m.referencia || '').toLowerCase()
      if (!desc.includes(q) && !ref.includes(q)) return false
    }
    return true
  })

  const tieneFiltrosActivos =
    filtroEstado !== 'todos' ||
    filtroTipo !== 'todos' ||
    !!filtroDesde || !!filtroHasta ||
    !!filtroTexto.trim()

  function limpiarFiltros() {
    setFiltroEstado('todos')
    setFiltroTipo('todos')
    setFiltroDesde('')
    setFiltroHasta('')
    setFiltroTexto('')
  }

  function exportarExcel() {
    if (!cuentaId) return
    const params = new URLSearchParams()
    if (filtroDesde) params.set('desde', filtroDesde)
    if (filtroHasta) params.set('hasta', filtroHasta)
    if (filtroEstado !== 'todos') params.set('estado', filtroEstado)
    if (filtroTipo !== 'todos') params.set('tipo', filtroTipo)
    if (filtroTexto.trim()) params.set('q', filtroTexto.trim())
    const url = `/api/contabilidad/cuentas/${cuentaId}/movimientos/export?${params.toString()}`
    window.open(url, '_blank')
  }

  // Selección: toggle individual
  function toggleSeleccion(id: number) {
    setSeleccion(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all / none (solo sobre movimientos filtrados visibles)
  function toggleSeleccionarTodos() {
    if (seleccion.size === movimientosFiltrados.length && movimientosFiltrados.length > 0) {
      setSeleccion(new Set())
    } else {
      setSeleccion(new Set(movimientosFiltrados.map((m: any) => m.id)))
    }
  }

  function eliminarSeleccionados() {
    if (seleccion.size === 0 || !cuentaId) return
    const ids = Array.from(seleccion)
    const concIds = movimientos.filter((m: any) => seleccion.has(m.id) && m.conciliado).map((m: any) => m.id)
    const aviso = concIds.length > 0
      ? `¿Eliminar ${ids.length} movimiento(s)? ${concIds.length} está(n) conciliado(s) con facturas — al eliminar se romperá(n) esa(s) conciliación(es).`
      : `¿Eliminar ${ids.length} movimiento(s)?`

    setConfirmacion({
      titulo: '¿Eliminar movimientos?',
      descripcion: aviso,
      textoConfirmar: 'Sí, eliminar',
      onConfirmar: async () => {
        setConfirmacion(null)
        setEliminando(true)
        try {
          const res = await fetch(`/api/contabilidad/cuentas/${cuentaId}/movimientos/bulk-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
          })
          if (res.ok) {
            setSeleccion(new Set())
            fetchMovimientos()
          } else {
            const d = await res.json().catch(() => ({}))
            toast.error(d.error || 'Error al eliminar')
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Error de red')
        } finally {
          setEliminando(false)
        }
      },
    })
  }

  const handleConciliar = async (movimientoId: number, facturaId: number | null) => {
    const res = await fetch('/api/contabilidad/conciliacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movimientoId, facturaId }),
    })
    if (res.ok) {
      fetchMovimientos()
      queryClient.invalidateQueries({ queryKey: ['contabilidad', 'facturas'] })
    }
  }

  const handleDeleteMovimiento = (movId: number) => {
    setConfirmacion({
      titulo: '¿Eliminar este movimiento?',
      textoConfirmar: 'Sí, eliminar',
      onConfirmar: async () => {
        setConfirmacion(null)
        const res = await fetch(`/api/contabilidad/cuentas/${cuentaId}/movimientos/${movId}`, { method: 'DELETE' })
        if (res.ok) {
          fetchMovimientos()
        } else {
          const data = await res.json().catch(() => null)
          toast.error(data?.error ?? 'No se pudo eliminar el movimiento')
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={cuentaId} onChange={(e) => { setCuentaId(e.target.value) }}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-card min-w-[250px]">
          <option value="">Seleccionar cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>
          ))}
        </select>
        <Button variant="outline" onClick={() => fetchMovimientos()} disabled={!cuentaId}>Cargar</Button>
        <Button onClick={() => { setShowAddForm(!showAddForm); setShowTransferForm(false) }} disabled={!cuentaId}>
          <Plus className="w-4 h-4" /> Movimiento
        </Button>
        <Button variant="outline" onClick={() => { setShowTransferForm(!showTransferForm); setShowAddForm(false) }}>
          <ArrowRightLeft className="w-4 h-4" /> Transferencia
        </Button>
        <Button variant="outline" onClick={() => setShowImportModal(true)} disabled={!cuentaId}>
          <Upload className="w-4 h-4" /> Importar Extracto
        </Button>
        <Button variant="outline" onClick={exportarExcel} disabled={!cuentaId || movimientos.length === 0}>
          <Download className="w-4 h-4" /> Exportar Excel
        </Button>
      </div>

      {/* Filtros */}
      {cuentaId && movimientos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
              className="h-8 text-xs border border-border rounded bg-card px-2"
            >
              <option value="todos">Todos</option>
              <option value="sin">Sin conciliar</option>
              <option value="conciliados">Conciliados</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Tipo:</span>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
              className="h-8 text-xs border border-border rounded bg-card px-2"
            >
              <option value="todos">Todos</option>
              <option value="credito">Créditos</option>
              <option value="debito">Débitos</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Desde:</span>
            <input
              type="date"
              value={filtroDesde}
              onChange={(e) => setFiltroDesde(e.target.value)}
              className="h-8 text-xs border border-border rounded bg-card px-2"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Hasta:</span>
            <input
              type="date"
              value={filtroHasta}
              onChange={(e) => setFiltroHasta(e.target.value)}
              className="h-8 text-xs border border-border rounded bg-card px-2"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Descripción o referencia…"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="h-8 text-xs border border-border rounded bg-card px-2 flex-1 min-w-0"
            />
          </div>

          {tieneFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/40"
              title="Limpiar filtros"
            >
              <X className="w-3.5 h-3.5 inline" /> Limpiar
            </button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {movimientosFiltrados.length} de {movimientos.length}
          </span>
        </div>
      )}

      {showImportModal && cuentaId && (
        <ImportarExtractoModal
          cuentaId={parseInt(cuentaId)}
          cuentaNombre={cuentas.find(c => c.id === parseInt(cuentaId))?.nombre || ''}
          onClose={() => setShowImportModal(false)}
          onImported={() => fetchMovimientos()}
        />
      )}

      {showAddForm && cuentaId && (
        <MovimientoForm
          cuentaId={parseInt(cuentaId)}
          onClose={() => setShowAddForm(false)}
          onSaved={() => { setShowAddForm(false); fetchMovimientos() }}
        />
      )}

      {showTransferForm && (
        <TransferenciaForm
          cuentas={cuentas}
          cuentaOrigenId={cuentaId}
          onClose={() => setShowTransferForm(false)}
          onSaved={() => { setShowTransferForm(false); fetchMovimientos() }}
        />
      )}

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}

      {!loading && movimientos.length > 0 && (
        <>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Movimientos</p>
            <p className="text-lg font-bold">{movimientosFiltrados.length}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Créditos</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(movimientosFiltrados.filter((m: any) => m.tipo === 'credito').reduce((s: number, m: any) => s + m.monto, 0))}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Débitos</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(movimientosFiltrados.filter((m: any) => m.tipo === 'debito').reduce((s: number, m: any) => s + m.monto, 0))}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Sin conciliar</p>
            <p className="text-lg font-bold text-yellow-600">{movimientosFiltrados.filter((m: any) => !m.conciliado).length}</p>
          </div>
        </div>
        {seleccion.size > 0 && (
          <div className="flex items-center justify-between gap-3 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-foreground">
              {seleccion.size} movimiento{seleccion.size === 1 ? '' : 's'} seleccionado{seleccion.size === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSeleccion(new Set())} disabled={eliminando}>
                Cancelar selección
              </Button>
              <Button
                size="sm"
                color="danger"
                onClick={eliminarSeleccionados}
                disabled={eliminando}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {eliminando ? 'Eliminando...' : `Eliminar ${seleccion.size}`}
              </Button>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={movimientosFiltrados.length > 0 && seleccion.size === movimientosFiltrados.length}
                    ref={el => {
                      if (el) el.indeterminate = seleccion.size > 0 && seleccion.size < movimientosFiltrados.length
                    }}
                    onChange={toggleSeleccionarTodos}
                    className="rounded border-border cursor-pointer"
                    title="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-center">Conciliado</TableHead>
                <TableHead className="text-center">Factura</TableHead>
                <TableHead className="text-center">Recibo</TableHead>
                <TableHead className="text-center w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientosFiltrados.length === 0 && (
                <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground text-sm">
                  Sin movimientos que coincidan con los filtros
                </TableCell></TableRow>
              )}
              {movimientosFiltrados.map((m: any) => (
                <TableRow key={m.id} className={seleccion.has(m.id) ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={seleccion.has(m.id)}
                      onChange={() => toggleSeleccion(m.id)}
                      className="rounded border-border cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(m.fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </span>
                  </TableCell>
                  <TableCell>{m.descripcion}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{m.referencia || '—'}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${m.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.tipo === 'credito' ? '+' : '-'}{formatCurrency(m.monto)}
                  </TableCell>
                  <TableCell className="text-center">
                    {m.conciliado ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sí
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {m.factura ? (
                      <div className="flex items-center gap-1 justify-center">
                        <Link href={`/contabilidad/facturas/${m.factura.id}`} className="text-xs text-primary hover:underline">
                          #{m.factura.numero}
                        </Link>
                        <button onClick={() => handleConciliar(m.id, null)} className="text-muted-foreground hover:text-red-500" title="Desvincular">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <select
                        className={`text-xs border rounded px-1 py-0.5 bg-card ${
                          facturasDisponibles.some((f: any) => f.estado !== 'anulada' && Math.abs(f.total - m.monto) < 0.02)
                            ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-border'
                        }`}
                        value=""
                        onChange={(e) => { if (e.target.value) handleConciliar(m.id, parseInt(e.target.value)) }}
                      >
                        <option value="">Vincular...</option>
                        {/* Show matching amounts first */}
                        {facturasDisponibles
                          .filter((f: any) => f.estado !== 'anulada')
                          .sort((a: any, b: any) => {
                            const aMatch = Math.abs(a.total - m.monto) < 0.02 ? 0 : 1
                            const bMatch = Math.abs(b.total - m.monto) < 0.02 ? 0 : 1
                            return aMatch - bMatch
                          })
                          .map((f: any) => {
                            const montoMatch = Math.abs(f.total - m.monto) < 0.02
                            return (
                              <option key={f.id} value={f.id}>
                                {montoMatch ? '✓ ' : ''}#{f.numero} — {formatCurrency(f.total)} — {f.proveedor || f.cliente?.nombre || 'Sin nombre'} [{f.estado}]
                              </option>
                            )
                          })}
                      </select>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {m.recibo ? (
                      <span className="text-xs font-mono text-primary">{m.recibo.numero}</span>
                    ) : m.tipo === 'credito' && !m.reciboId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMovimientoConvertir(m)}
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs"
                      >
                        Crear recibo
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <button onClick={() => handleDeleteMovimiento(m.id)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Eliminar movimiento" aria-label="Eliminar movimiento">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {!loading && movimientos.length === 0 && cuentaId && (
        <div className="text-center py-12 text-muted-foreground">
          <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No hay movimientos registrados en esta cuenta</p>
        </div>
      )}

      <ConfirmDialog
        abierto={confirmacion !== null}
        titulo={confirmacion?.titulo ?? ''}
        descripcion={confirmacion?.descripcion}
        textoConfirmar={confirmacion?.textoConfirmar ?? 'Confirmar'}
        variante="peligro"
        onConfirmar={() => confirmacion?.onConfirmar()}
        onCancelar={() => setConfirmacion(null)}
      />

      {movimientoConvertir && (
        <ConvertirCreditoRecibo
          movimiento={{
            id: movimientoConvertir.id,
            monto: movimientoConvertir.monto,
            fecha: movimientoConvertir.fecha,
            descripcion: movimientoConvertir.descripcion,
            referencia: movimientoConvertir.referencia,
          }}
          clientes={clientes}
          onClose={() => setMovimientoConvertir(null)}
          onDone={() => { setMovimientoConvertir(null); fetchMovimientos() }}
        />
      )}
    </div>
  )
}

// ── Movimiento Form ──────────────────────────────────────────────────────

function MovimientoForm({ cuentaId, onClose, onSaved }: { cuentaId: number; onClose: () => void; onSaved: () => void }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState('debito')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch(`/api/contabilidad/cuentas/${cuentaId}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, tipo, monto: parseFloat(monto) || 0, descripcion, referencia: referencia || null }),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error || 'Error')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Nuevo Movimiento Bancario</h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
            <option value="debito">Débito (salida)</option>
            <option value="credito">Crédito (entrada)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Monto *</label>
          <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Descripción *</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Referencia</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-full flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Agregar'}</Button>
        </div>
      </form>
    </div>
  )
}

// ── Transferencia Form ──────────────────────────────────────────────────

function TransferenciaForm({ cuentas, cuentaOrigenId, onClose, onSaved }: {
  cuentas: CuentaBancariaConSaldo[]; cuentaOrigenId: string; onClose: () => void; onSaved: () => void
}) {
  const [origenId, setOrigenId] = useState(cuentaOrigenId)
  const [destinoId, setDestinoId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [referencia, setReferencia] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const origen = cuentas.find(c => c.id.toString() === origenId)
  const destino = cuentas.find(c => c.id.toString() === destinoId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/contabilidad/transferencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cuentaOrigenId: parseInt(origenId),
        cuentaDestinoId: parseInt(destinoId),
        monto: parseFloat(monto) || 0,
        fecha,
        descripcion: descripcion || undefined,
        referencia: referencia || undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setSuccess(data.message)
      setTimeout(() => onSaved(), 1500)
    } else {
      setError(data.error || 'Error al transferir')
    }
    setLoading(false)
  }

  const inputCls = 'w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="bg-card border border-purple-200 dark:border-purple-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-purple-500" /> Transferencia entre cuentas
        </h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Transfiere fondos entre cuentas. Ej: pago de tarjeta de crédito desde cuenta corriente.
      </p>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-3">{success}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cuenta origen (sale dinero) *</label>
            <select value={origenId} onChange={(e) => setOrigenId(e.target.value)} className={inputCls} required>
              <option value="">Seleccionar...</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id.toString() === destinoId}>
                  {c.nombre} — {c.banco} {c.tipoCuenta === 'tarjeta_credito' ? '(TC)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cuenta destino (recibe dinero) *</label>
            <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className={inputCls} required>
              <option value="">Seleccionar...</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id.toString() === origenId}>
                  {c.nombre} — {c.banco} {c.tipoCuenta === 'tarjeta_credito' ? '(TC)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {origen && destino && (
          <div className="flex items-center justify-center gap-3 py-2 text-sm">
            <span className="px-3 py-1 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-medium">{origen.nombre}</span>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            <span className="px-3 py-1 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium">{destino.nombre}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Monto *</label>
            <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} required placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descripción</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputCls} placeholder="Pago tarjeta, transferencia..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Referencia</label>
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls} placeholder="Nro. referencia" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading || !origenId || !destinoId}>
            {loading ? 'Procesando...' : 'Realizar Transferencia'}
          </Button>
        </div>
      </form>
    </div>
  )
}
