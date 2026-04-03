'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ETAPAS_PRODUCCION, ETAPA_COLORS, ESTADO_COLORS, PRIORIDAD_COLORS,
  PRIORIDADES, ESTADOS_ORDEN, ETAPA_ORDER, ETAPA_DESCRIPCION, HORAS_ESTIMADAS,
} from '@/lib/produccion'
import type { EtapaLog, PiezaProgreso } from '@/lib/produccion'
import {
  ArrowLeft, ArrowRight, ShoppingCart, PackageCheck, Scissors, Layers,
  Cog, ClipboardCheck, Hammer, ShieldCheck, Settings, Trash2, Save,
  Loader2, FileDown, Check, AlertCircle, CheckCircle2, Circle,
  Download, Clock,
} from 'lucide-react'

const STAGE_ICONS: Record<string, React.ElementType> = {
  'ShoppingCart': ShoppingCart, 'PackageCheck': PackageCheck, 'Scissors': Scissors,
  'Layers': Layers, 'Cog': Cog, 'ClipboardCheck': ClipboardCheck,
  'Hammer': Hammer, 'ShieldCheck': ShieldCheck,
}

interface Pieza {
  id: number
  nombre: string
  etiqueta: string
  largo: number
  ancho: number
  cantidad: number
  espesor: number
  material: string | null
  tapacanto: string
  llevaMecanizado: boolean
  tipoMecanizado: string | null
  moduloNombre: string
}

interface Item {
  id: number
  nombreModulo: string
  tipoModulo: string | null
  dimensiones: string | null
  cantidad: number
  observaciones: string | null
  completado: boolean
}

interface Material {
  id: number
  nombre: string
  tipo: string | null
  unidad: string
  cantidadRequerida: number
  cantidadComprada: number
  cantidadRecibida: number
  costoUnitario: number
  costoTotal: number
  proveedor: string | null
  estado: string
  notas: string | null
}

interface QCItem {
  item: string
  checked: boolean
}

interface Orden {
  id: number
  codigo: string
  nombre: string
  estado: string
  etapaActual: string
  prioridad: string
  clienteNombre: string | null
  notas: string | null
  checklistQCProceso: string | null
  checklistQCFinal: string | null
  notasQCProceso: string | null
  notasQCFinal: string | null
  etapasLog: string | null
  progresoPiezas: string | null
  proyecto: { id: number; nombre: string } | null
  items: Item[]
  materiales: Material[]
  fechaInicio: string | null
  fechaEstimada: string | null
  createdAt: string
}

interface Props {
  orden: Orden
  usuarios: { id: number; nombre: string }[]
  piezas: Pieza[]
}

// ── Helper: parse stage timestamps ──
function parseEtapasLog(json: string | null): EtapaLog[] {
  try { return json ? JSON.parse(json) : [] } catch { return [] }
}

function parsePiezaProgreso(json: string | null): Record<string, PiezaProgreso> {
  try { return json ? JSON.parse(json) : {} } catch { return {} }
}

function formatDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const hours = (e - s) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)} hrs`
  return `${(hours / 24).toFixed(1)} días`
}

export function OrdenProduccionDetail({ orden, usuarios, piezas }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'etapa' | 'tiempos' | 'config'>('etapa')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')

  const [estado, setEstado] = useState(orden.estado)
  const [prioridad, setPrioridad] = useState(orden.prioridad)
  const [notas, setNotas] = useState(orden.notas || '')

  const currentEtapaIdx = ETAPA_ORDER[orden.etapaActual] ?? 0
  const currentEtapa = ETAPAS_PRODUCCION[currentEtapaIdx]
  const colors = ETAPA_COLORS[orden.etapaActual]
  const isCompleted = orden.estado === 'Completada'
  const isCancelled = orden.estado === 'Cancelada'
  const etapasLog = parseEtapasLog(orden.etapasLog)

  async function handleAdvanceStage() {
    setAdvancing(true)
    setError('')
    const res = await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _avanzarEtapa: true }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Error al avanzar etapa')
    }
    router.refresh()
    setAdvancing(false)
  }

  async function handleRetrocederStage() {
    setAdvancing(true)
    setError('')
    const res = await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _retrocederEtapa: true }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Error al retroceder')
    }
    router.refresh()
    setAdvancing(false)
  }

  async function handleComplete() {
    setAdvancing(true)
    setError('')
    const res = await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _completar: true }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Error al completar')
    }
    router.refresh()
    setAdvancing(false)
  }

  async function handleSaveConfig() {
    setSaving(true)
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado, prioridad, notas }),
    })
    router.refresh()
    setSaving(false)
  }

  async function handleDeleteOrder() {
    if (!confirm('¿Eliminar esta orden y todos sus items?')) return
    await fetch(`/api/produccion/${orden.id}`, { method: 'DELETE' })
    router.push('/produccion?msg=eliminado')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/produccion">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{orden.nombre}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[orden.estado] || ''}`}>{orden.estado}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLORS[orden.prioridad] || ''}`}>{orden.prioridad}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{orden.codigo}</span>
              {orden.proyecto && <Link href={`/proyectos/${orden.proyecto.id}`} className="hover:text-primary">• {orden.proyecto.nombre}</Link>}
              <span>• {orden.items.length} módulos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STEPPER ── */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {ETAPAS_PRODUCCION.map((etapa, idx) => {
            const isPast = isCompleted || idx < currentEtapaIdx
            const isCurrent = idx === currentEtapaIdx && !isCompleted
            const StageIcon = STAGE_ICONS[etapa.icon] || Circle
            const stepColors = ETAPA_COLORS[etapa.key]
            const logEntry = etapasLog.find(e => e.etapa === etapa.key)

            return (
              <div key={etapa.key} className="flex flex-col items-center flex-1 relative">
                {idx > 0 && (
                  <div className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                    isPast || isCurrent ? 'bg-primary' : 'bg-border'
                  }`} style={{ left: '-50%', right: '50%' }} />
                )}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isPast
                    ? 'bg-primary text-white'
                    : isCurrent
                      ? `${stepColors?.bg || ''} ${stepColors?.text || ''} ring-2 ring-primary ring-offset-2 ring-offset-background`
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {isPast ? <Check className="w-4 h-4" /> : <StageIcon className="w-3.5 h-3.5" />}
                </div>
                <span className={`mt-1.5 text-[10px] font-medium text-center leading-tight ${
                  isCurrent ? 'text-foreground' : 'text-muted-foreground'
                }`}>{etapa.label}</span>
                {logEntry && logEntry.fin && (
                  <span className="text-[9px] text-muted-foreground/60">{formatDuration(logEntry.inicio, logEntry.fin)}</span>
                )}
                {logEntry && !logEntry.fin && isCurrent && (
                  <span className="text-[9px] text-primary">{formatDuration(logEntry.inicio, null)}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: 'etapa' as const, label: isCompleted ? 'Completada' : (currentEtapa?.label || 'Etapa'), icon: currentEtapa ? (STAGE_ICONS[currentEtapa.icon] || Circle) : Circle },
          { key: 'tiempos' as const, label: 'Tiempos', icon: Clock },
          { key: 'config' as const, label: 'Configuración', icon: Settings },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── STAGE CONTENT ── */}
      {tab === 'etapa' && !isCompleted && !isCancelled && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border-2 ${colors?.border || ''} ${colors?.bg || ''}`}>
            <p className={`text-sm font-medium ${colors?.text || ''}`}>{ETAPA_DESCRIPCION[orden.etapaActual] || ''}</p>
          </div>

          {orden.etapaActual === 'Compra de Materiales' && <CompraPanel orden={orden} />}
          {orden.etapaActual === 'Recepcion' && <RecepcionPanel orden={orden} />}
          {orden.etapaActual === 'Corte' && <CortePanel orden={orden} piezas={piezas} />}
          {orden.etapaActual === 'Canteo' && <CanteoPanel orden={orden} piezas={piezas} />}
          {orden.etapaActual === 'Mecanizacion' && <MecanizacionPanel orden={orden} piezas={piezas} />}
          {orden.etapaActual === 'QC Proceso' && <QCPanel orden={orden} field="checklistQCProceso" title="QC Proceso" />}
          {orden.etapaActual === 'Ensamble' && <EnsamblePanel orden={orden} />}
          {orden.etapaActual === 'QC Final' && <QCPanel orden={orden} field="checklistQCFinal" title="QC Final" />}

          {/* Navigation buttons */}
          <div className="flex justify-between pt-2">
            <div>
              {currentEtapaIdx > 0 && (
                <Button variant="outline" onClick={handleRetrocederStage} disabled={advancing} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Volver a {ETAPAS_PRODUCCION[currentEtapaIdx - 1]?.label}
                </Button>
              )}
            </div>
            <div>
              {orden.etapaActual === 'QC Final' ? (
                <Button onClick={handleComplete} disabled={advancing} className="gap-2">
                  {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Completar — Listo para Instalación
                </Button>
              ) : (
                <Button onClick={handleAdvanceStage} disabled={advancing} className="gap-2">
                  {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Avanzar a {ETAPAS_PRODUCCION[currentEtapaIdx + 1]?.label}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'etapa' && isCompleted && (
        <Card><CardContent className="py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">Orden Completada</h3>
          <p className="text-sm text-muted-foreground mt-1">Módulos listos para instalación.</p>
        </CardContent></Card>
      )}

      {/* ── TIEMPOS TAB ── */}
      {tab === 'tiempos' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Registro de Tiempos por Etapa</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Etapa</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Inicio</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Fin</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Duración</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Estimado</th>
                </tr>
              </thead>
              <tbody>
                {ETAPAS_PRODUCCION.map(etapa => {
                  const entry = etapasLog.find(e => e.etapa === etapa.key)
                  const ec = ETAPA_COLORS[etapa.key]
                  return (
                    <tr key={etapa.key} className="border-b border-border">
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${ec?.text || ''}`}>
                          <span className={`w-2 h-2 rounded-full ${ec?.dot || ''}`} />{etapa.label}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {entry ? new Date(entry.inicio).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {entry?.fin ? new Date(entry.fin).toLocaleString('es-DO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : (entry ? 'En curso' : '-')}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {entry ? formatDuration(entry.inicio, entry.fin) : '-'}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{HORAS_ESTIMADAS[etapa.key]} hrs</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── CONFIG TAB ── */}
      {tab === 'config' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Configuración de la Orden</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm">
                  {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Prioridad</label>
                <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm">
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Módulos ({orden.items.length})</label>
              <div className="space-y-1">
                {orden.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm">
                    <span className="font-medium text-foreground">{item.nombreModulo}</span>
                    {item.dimensiones && <span className="text-muted-foreground ml-auto">{item.dimensiones}</span>}
                    {item.cantidad > 1 && <span className="text-muted-foreground">×{item.cantidad}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notas</label>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm resize-none" />
            </div>
            <div className="flex gap-3 justify-between">
              <Button variant="danger" onClick={handleDeleteOrder}><Trash2 className="w-4 h-4" /> Eliminar</Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE PANELS
// ═══════════════════════════════════════════════════════════════════════

// ── COMPRA ──
function CompraPanel({ orden }: { orden: Orden }) {
  const router = useRouter()
  const [edits, setEdits] = useState<Record<number, Partial<Material>>>({})
  const [saving, setSaving] = useState(false)

  const groups = [
    { title: 'Tableros', items: orden.materiales.filter(m => m.tipo === 'tablero') },
    { title: 'Cantos', items: orden.materiales.filter(m => m.tipo === 'canto') },
    { title: 'Herrajes', items: orden.materiales.filter(m => m.tipo === 'herraje') },
    { title: 'Otros', items: orden.materiales.filter(m => !['tablero', 'canto', 'herraje'].includes(m.tipo || '')) },
  ].filter(g => g.items.length > 0)

  function updateField(id: number, field: string, value: string | number) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/produccion/${orden.id}/materiales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: Object.entries(edits).map(([id, c]) => ({ id: parseInt(id), ...c })) }),
    })
    setEdits({})
    router.refresh()
    setSaving(false)
  }

  const totalCost = orden.materiales.reduce((s, m) => s + m.costoTotal, 0)

  if (orden.materiales.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">No hay materiales. Se generan al importar desde un espacio.</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{orden.materiales.length} materiales</p>
          <p className="text-xs text-muted-foreground">Total: RD${totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
        </div>
        <Link href={`/produccion/${orden.id}/lista-compra`} target="_blank">
          <Button variant="outline" className="gap-2"><FileDown className="w-4 h-4" /> PDF Lista de Compra</Button>
        </Link>
      </div>

      {groups.map(g => (
        <Card key={g.title}>
          <CardHeader className="py-3"><CardTitle className="text-sm">{g.title} ({g.items.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Material</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Requerido</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Comprado</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">Costo</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Estado</th>
              </tr></thead>
              <tbody>
                {g.items.map(m => {
                  const edit = edits[m.id] || {}
                  return (
                    <tr key={m.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2 px-4"><p className="font-medium text-foreground">{m.nombre}</p>{m.proveedor && <p className="text-xs text-muted-foreground">{m.proveedor}</p>}</td>
                      <td className="py-2 px-4 text-center"><span className="font-medium">{m.cantidadRequerida}</span> <span className="text-muted-foreground">{m.unidad}</span></td>
                      <td className="py-2 px-4 text-center">
                        <input type="number" min="0" step="0.01" value={edit.cantidadComprada ?? m.cantidadComprada}
                          onChange={(e) => updateField(m.id, 'cantidadComprada', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded border border-border bg-input text-foreground text-sm text-center" />
                      </td>
                      <td className="py-2 px-4 text-right text-muted-foreground">RD${m.costoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-4 text-center">
                        <select value={(edit.estado as string) ?? m.estado} onChange={(e) => updateField(m.id, 'estado', e.target.value)}
                          className="px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer bg-muted text-foreground">
                          <option value="Pendiente">Pendiente</option>
                          <option value="Comprado">Comprado</option>
                          <option value="Parcial">Parcial</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {Object.keys(edits).length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar</Button>
        </div>
      )}
    </div>
  )
}

// ── RECEPCIÓN ──
function RecepcionPanel({ orden }: { orden: Orden }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const received = orden.materiales.filter(m => m.estado === 'Recibido').length

  async function quickAction(materialId: number, action: 'Recibido' | 'Parcial' | 'Pendiente', cantidadRecibida?: number) {
    setSaving(true)
    const mat = orden.materiales.find(m => m.id === materialId)
    if (!mat) return

    const updates = [{
      id: materialId,
      estado: action,
      cantidadRecibida: action === 'Recibido' ? mat.cantidadComprada || mat.cantidadRequerida
        : action === 'Pendiente' ? 0
        : cantidadRecibida ?? mat.cantidadRecibida,
    }]

    await fetch(`/api/produccion/${orden.id}/materiales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    router.refresh()
    setSaving(false)
  }

  async function saveNota(materialId: number, notas: string) {
    await fetch(`/api/produccion/${orden.id}/materiales/${materialId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notas }),
    })
  }

  async function recibirTodo() {
    setSaving(true)
    const updates = orden.materiales.map(m => ({
      id: m.id,
      estado: 'Recibido',
      cantidadRecibida: m.cantidadComprada || m.cantidadRequerida,
    }))
    await fetch(`/api/produccion/${orden.id}/materiales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    router.refresh()
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-muted rounded-full h-2.5 w-40">
            <div className="bg-indigo-500 h-2.5 rounded-full transition-all" style={{ width: orden.materiales.length > 0 ? `${(received / orden.materiales.length) * 100}%` : '0%' }} />
          </div>
          <span className="text-sm font-medium">{received}/{orden.materiales.length} recibidos</span>
        </div>
        <Button variant="outline" size="sm" onClick={recibirTodo} disabled={saving} className="gap-2">
          <Check className="w-3.5 h-3.5" /> Recibir Todo
        </Button>
      </div>

      <div className="space-y-2">
        {orden.materiales.map(m => (
          <RecepcionItem key={m.id} material={m} onAction={quickAction} onSaveNota={saveNota} saving={saving} />
        ))}
      </div>
    </div>
  )
}

function RecepcionItem({ material: m, onAction, onSaveNota, saving }: {
  material: Material
  onAction: (id: number, action: 'Recibido' | 'Parcial' | 'Pendiente', qty?: number) => void
  onSaveNota: (id: number, notas: string) => void
  saving: boolean
}) {
  const [showNotas, setShowNotas] = useState(false)
  const [notas, setNotas] = useState(m.notas || '')
  const [parcialQty, setParcialQty] = useState(m.cantidadRecibida)
  const [showParcial, setShowParcial] = useState(false)

  const estadoColor = m.estado === 'Recibido' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
    : m.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400'

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">{m.nombre}</span>
              <span className="text-xs text-muted-foreground capitalize">{m.tipo}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${estadoColor}`}>{m.estado}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Requerido: {m.cantidadRequerida} {m.unidad} · Comprado: {m.cantidadComprada} {m.unidad}
              {m.cantidadRecibida > 0 && ` · Recibido: ${m.cantidadRecibida} ${m.unidad}`}
            </p>
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={() => onAction(m.id, 'Recibido')}
              disabled={saving || m.estado === 'Recibido'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                m.estado === 'Recibido' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-muted hover:bg-green-100 hover:text-green-700 text-foreground'
              }`}
            >Recibido</button>
            <button
              onClick={() => setShowParcial(!showParcial)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                m.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-muted hover:bg-yellow-100 hover:text-yellow-700 text-foreground'
              }`}
            >Parcial</button>
            <button
              onClick={() => onAction(m.id, 'Pendiente')}
              disabled={saving || m.estado === 'Pendiente'}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-red-100 hover:text-red-700 text-foreground transition-colors"
            >Pendiente</button>
            <button
              onClick={() => setShowNotas(!showNotas)}
              className="px-2 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground hover:text-foreground"
              title="Notas"
            >📝</button>
          </div>
        </div>

        {showParcial && (
          <div className="flex items-center gap-2 mt-2 pl-4">
            <span className="text-xs text-muted-foreground">Cantidad recibida:</span>
            <input type="number" min="0" step="0.01" value={parcialQty}
              onChange={(e) => setParcialQty(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 rounded border border-border bg-input text-foreground text-sm" />
            <Button size="sm" onClick={() => { onAction(m.id, 'Parcial', parcialQty); setShowParcial(false) }}>OK</Button>
          </div>
        )}

        {showNotas && (
          <div className="mt-2 pl-4">
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Discrepancias o notas de recepción..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm resize-none"
            />
            <div className="flex justify-end mt-1">
              <Button size="sm" variant="outline" onClick={() => { onSaveNota(m.id, notas); setShowNotas(false) }}>Guardar nota</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── CORTE ──
function CortePanel({ orden, piezas }: { orden: Orden; piezas: Pieza[] }) {
  // Group by material (tablero/plancha)
  const byMaterial = useMemo(() => {
    const map = new Map<string, Pieza[]>()
    for (const p of piezas) {
      const key = p.material || 'Sin material'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [piezas])

  const totalPiezas = piezas.reduce((s, p) => s + p.cantidad, 0)

  function exportCSV() {
    const header = 'Material,Modulo,Pieza,Etiqueta,Largo_mm,Ancho_mm,Espesor_mm,Cantidad\n'
    const rows = piezas.map(p =>
      `"${p.material || ''}","${p.moduloNombre}","${p.nombre}","${p.etiqueta}",${p.largo},${p.ancho},${p.espesor},${p.cantidad}`
    ).join('\n')

    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `corte-${orden.codigo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (piezas.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">No hay piezas de tablero registradas.</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{totalPiezas} piezas a cortar de {byMaterial.size} material{byMaterial.size > 1 ? 'es' : ''}</p>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="w-3.5 h-3.5" /> Exportar CSV (CNC)
        </Button>
      </div>

      {Array.from(byMaterial.entries()).map(([material, materialPiezas]) => {
        const totalArea = materialPiezas.reduce((s, p) => s + (p.largo * p.ancho * p.cantidad) / 1e6, 0)
        return (
          <Card key={material}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{material}</CardTitle>
                <span className="text-xs text-muted-foreground">{totalArea.toFixed(3)} m² — {materialPiezas.reduce((s, p) => s + p.cantidad, 0)} piezas</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Pieza</th>
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Módulo</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Largo</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Ancho</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Esp.</th>
                  <th className="text-center py-2 px-4 font-medium text-muted-foreground">Cant.</th>
                </tr></thead>
                <tbody>
                  {materialPiezas.map(p => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                      <td className="py-2 px-4"><span className="font-medium text-foreground">{p.nombre}</span> <span className="text-muted-foreground text-xs">({p.etiqueta})</span></td>
                      <td className="py-2 px-4 text-muted-foreground">{p.moduloNombre}</td>
                      <td className="py-2 px-4 text-center">{p.largo}</td>
                      <td className="py-2 px-4 text-center">{p.ancho}</td>
                      <td className="py-2 px-4 text-center">{p.espesor}</td>
                      <td className="py-2 px-4 text-center font-medium">{p.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ── CANTEO ──
function CanteoPanel({ orden, piezas }: { orden: Orden; piezas: Pieza[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [progreso, setProgreso] = useState<Record<string, PiezaProgreso>>(() => parsePiezaProgreso(orden.progresoPiezas))

  // Only pieces with tapacanto
  const piezasConCanto = useMemo(() => {
    return piezas.filter(p => {
      try { const tc = JSON.parse(p.tapacanto); return Array.isArray(tc) && tc.length > 0 } catch { return false }
    })
  }, [piezas])

  // Group by material
  const byMaterial = useMemo(() => {
    const map = new Map<string, Pieza[]>()
    for (const p of piezasConCanto) {
      const key = p.material || 'Sin material'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [piezasConCanto])

  const canteadas = piezasConCanto.filter(p => progreso[p.id]?.canteado).length

  async function togglePieza(piezaId: number) {
    const next = { ...progreso }
    const current = next[piezaId] || { canteado: false, mecanizado: false }
    next[piezaId] = { ...current, canteado: !current.canteado }
    setProgreso(next)

    setSaving(true)
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _progresoPiezas: next }),
    })
    setSaving(false)
  }

  async function cantearTodo() {
    const next = { ...progreso }
    piezasConCanto.forEach(p => { next[p.id] = { ...(next[p.id] || { mecanizado: false }), canteado: true } })
    setProgreso(next)

    setSaving(true)
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _progresoPiezas: next }),
    })
    router.refresh()
    setSaving(false)
  }

  if (piezasConCanto.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">No hay piezas que requieran canteo.</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted rounded-full h-2.5 w-40">
            <div className="bg-cyan-500 h-2.5 rounded-full transition-all" style={{ width: `${(canteadas / piezasConCanto.length) * 100}%` }} />
          </div>
          <span className="text-sm font-medium">{canteadas}/{piezasConCanto.length} canteadas</span>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="outline" size="sm" onClick={cantearTodo} disabled={saving} className="gap-2">
          <Check className="w-3.5 h-3.5" /> Canteado Todo
        </Button>
      </div>

      {Array.from(byMaterial.entries()).map(([material, materialPiezas]) => (
        <Card key={material}>
          <CardHeader className="py-3"><CardTitle className="text-sm">{material}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="w-10 py-2 px-4"></th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Pieza</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Módulo</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Dimensiones</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Cantos</th>
              </tr></thead>
              <tbody>
                {materialPiezas.map(p => {
                  const done = progreso[p.id]?.canteado || false
                  let cantos: string[] = []
                  try { cantos = JSON.parse(p.tapacanto) } catch { cantos = [] }
                  const labels: Record<string, string> = { superior: 'Sup', inferior: 'Inf', izquierdo: 'Izq', derecho: 'Der' }
                  return (
                    <tr key={p.id} className={`border-b border-border transition-colors ${done ? 'bg-cyan-50/50 dark:bg-cyan-500/5' : 'hover:bg-muted/20'}`}>
                      <td className="py-2 px-4">
                        <input type="checkbox" checked={done} onChange={() => togglePieza(p.id)} className="accent-primary w-4 h-4" />
                      </td>
                      <td className={`py-2 px-4 font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{p.nombre} ({p.etiqueta})</td>
                      <td className="py-2 px-4 text-muted-foreground">{p.moduloNombre}</td>
                      <td className="py-2 px-4 text-center text-muted-foreground">{p.largo}×{p.ancho} mm</td>
                      <td className="py-2 px-4">
                        <div className="flex gap-1">
                          {cantos.filter(c => !c.startsWith('_')).map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">{labels[c] || c}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── MECANIZACIÓN ──
function MecanizacionPanel({ orden, piezas }: { orden: Orden; piezas: Pieza[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [progreso, setProgreso] = useState<Record<string, PiezaProgreso>>(() => parsePiezaProgreso(orden.progresoPiezas))

  // Show all pieces — those with mecanizado flag will be highlighted
  const piezasMecanizado = useMemo(() => {
    return piezas.filter(p => p.llevaMecanizado || p.tipoMecanizado)
  }, [piezas])

  // If no pieces have mecanizado flags, show all pieces (user can check manually)
  const displayPiezas = piezasMecanizado.length > 0 ? piezasMecanizado : piezas

  const mecanizadas = displayPiezas.filter(p => progreso[p.id]?.mecanizado).length

  async function togglePieza(piezaId: number) {
    const next = { ...progreso }
    const current = next[piezaId] || { canteado: false, mecanizado: false }
    next[piezaId] = { ...current, mecanizado: !current.mecanizado }
    setProgreso(next)

    setSaving(true)
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _progresoPiezas: next }),
    })
    setSaving(false)
  }

  async function mecanizarTodo() {
    const next = { ...progreso }
    displayPiezas.forEach(p => { next[p.id] = { ...(next[p.id] || { canteado: false }), mecanizado: true } })
    setProgreso(next)

    setSaving(true)
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _progresoPiezas: next }),
    })
    router.refresh()
    setSaving(false)
  }

  if (displayPiezas.length === 0) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">No hay piezas que requieran mecanizado.</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted rounded-full h-2.5 w-40">
            <div className="bg-amber-500 h-2.5 rounded-full transition-all" style={{ width: `${(mecanizadas / displayPiezas.length) * 100}%` }} />
          </div>
          <span className="text-sm font-medium">{mecanizadas}/{displayPiezas.length} mecanizadas</span>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="outline" size="sm" onClick={mecanizarTodo} disabled={saving} className="gap-2">
          <Check className="w-3.5 h-3.5" /> Mecanizado Todo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30">
              <th className="w-10 py-2 px-4"></th>
              <th className="text-left py-2 px-4 font-medium text-muted-foreground">Pieza</th>
              <th className="text-left py-2 px-4 font-medium text-muted-foreground">Módulo</th>
              <th className="text-center py-2 px-4 font-medium text-muted-foreground">Dimensiones</th>
              <th className="text-left py-2 px-4 font-medium text-muted-foreground">Tipo Mecanizado</th>
            </tr></thead>
            <tbody>
              {displayPiezas.map(p => {
                const done = progreso[p.id]?.mecanizado || false
                return (
                  <tr key={p.id} className={`border-b border-border transition-colors ${done ? 'bg-amber-50/50 dark:bg-amber-500/5' : 'hover:bg-muted/20'}`}>
                    <td className="py-2 px-4">
                      <input type="checkbox" checked={done} onChange={() => togglePieza(p.id)} className="accent-primary w-4 h-4" />
                    </td>
                    <td className={`py-2 px-4 font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{p.nombre} ({p.etiqueta})</td>
                    <td className="py-2 px-4 text-muted-foreground">{p.moduloNombre}</td>
                    <td className="py-2 px-4 text-center text-muted-foreground">{p.largo}×{p.ancho} mm</td>
                    <td className="py-2 px-4">
                      {p.tipoMecanizado ? (
                        <div className="flex gap-1 flex-wrap">
                          {p.tipoMecanizado.split(',').map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{t.trim()}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin especificar</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── QC PANEL (Proceso + Final) ──
function QCPanel({ orden, field, title }: { orden: Orden; field: 'checklistQCProceso' | 'checklistQCFinal'; title: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const notasField = field === 'checklistQCProceso' ? 'notasQCProceso' : 'notasQCFinal'
  const [qcNotas, setQcNotas] = useState(field === 'checklistQCProceso' ? (orden.notasQCProceso || '') : (orden.notasQCFinal || ''))

  const checklistJson = field === 'checklistQCProceso' ? orden.checklistQCProceso : orden.checklistQCFinal
  let items: QCItem[] = []
  try { items = checklistJson ? JSON.parse(checklistJson) : [] } catch { items = [] }

  const checkedCount = items.filter(i => i.checked).length
  const allChecked = items.length > 0 && checkedCount === items.length

  async function toggleItem(idx: number) {
    setSaving(true)
    const updated = items.map((item, i) => i !== idx ? item : { ...item, checked: !item.checked, checkedAt: !item.checked ? new Date().toISOString() : undefined })
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: updated }),
    })
    router.refresh()
    setSaving(false)
  }

  async function saveNotas() {
    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [notasField]: qcNotas }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {allChecked ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
              {title} <span className="text-sm text-muted-foreground font-normal">({checkedCount}/{items.length})</span>
            </CardTitle>
            {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((qcItem, idx) => (
            <label key={idx} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/30 ${qcItem.checked ? 'opacity-70' : ''}`}>
              <input type="checkbox" checked={qcItem.checked} onChange={() => toggleItem(idx)} disabled={saving} className="accent-primary w-5 h-5" />
              <span className={`text-sm ${qcItem.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{qcItem.item}</span>
            </label>
          ))}
          {allChecked && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-3 font-medium">✓ Checklist completado — puede avanzar.</p>
          )}
        </CardContent>
      </Card>

      {/* QC Notes */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Notas de {title}</CardTitle></CardHeader>
        <CardContent>
          <textarea
            value={qcNotas}
            onChange={(e) => setQcNotas(e.target.value)}
            placeholder="Documentar problemas encontrados, mejoras futuras, observaciones..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm resize-none"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="outline" onClick={saveNotas} className="gap-1"><Save className="w-3.5 h-3.5" /> Guardar Notas</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── ENSAMBLE ──
function EnsamblePanel({ orden }: { orden: Orden }) {
  const herrajes = orden.materiales.filter(m => m.tipo === 'herraje')
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm">Módulos a Ensamblar ({orden.items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {orden.items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.nombreModulo}</p>
                <p className="text-xs text-muted-foreground">{item.tipoModulo && `${item.tipoModulo} — `}{item.dimensiones}</p>
              </div>
              {item.cantidad > 1 && <span className="text-sm text-muted-foreground">×{item.cantidad}</span>}
            </div>
          ))}
        </CardContent>
      </Card>
      {herrajes.length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Herrajes a Instalar ({herrajes.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {herrajes.map(h => (
              <div key={h.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/20">
                <span className="text-sm text-foreground">{h.nombre}</span>
                <span className="text-sm text-muted-foreground">{h.cantidadRequerida} {h.unidad}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
