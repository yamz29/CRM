'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ETAPAS_PRODUCCION, ETAPA_COLORS, ESTADO_COLORS, PRIORIDAD_COLORS,
  PRIORIDADES, ESTADOS_ORDEN, ETAPA_ORDER, ETAPA_DESCRIPCION,
} from '@/lib/produccion'
import {
  ArrowLeft, ArrowRight, ShoppingCart, PackageCheck, Scissors, Layers,
  Cog, ClipboardCheck, Hammer, ShieldCheck, Settings, Trash2, Save,
  Loader2, FileDown, Check, AlertCircle, CheckCircle2, Circle,
} from 'lucide-react'

// Icon map for stages
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
}

interface QCItem {
  item: string
  checked: boolean
  checkedBy?: number
  checkedAt?: string
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

export function OrdenProduccionDetail({ orden, usuarios, piezas }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'etapa' | 'config'>('etapa')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')

  // Config fields
  const [estado, setEstado] = useState(orden.estado)
  const [prioridad, setPrioridad] = useState(orden.prioridad)
  const [notas, setNotas] = useState(orden.notas || '')

  const currentEtapaIdx = ETAPA_ORDER[orden.etapaActual] ?? 0
  const currentEtapa = ETAPAS_PRODUCCION[currentEtapaIdx]
  const colors = ETAPA_COLORS[orden.etapaActual]
  const isCompleted = orden.estado === 'Completada'
  const isCancelled = orden.estado === 'Cancelada'

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
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[orden.estado] || ''}`}>
                {orden.estado}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLORS[orden.prioridad] || ''}`}>
                {orden.prioridad}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{orden.codigo}</span>
              {orden.clienteNombre && <span>• {orden.clienteNombre}</span>}
              {orden.proyecto && (
                <Link href={`/proyectos/${orden.proyecto.id}`} className="hover:text-primary">
                  • {orden.proyecto.nombre}
                </Link>
              )}
              <span>• {orden.items.length} módulos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── STEPPER ── */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {ETAPAS_PRODUCCION.map((etapa, idx) => {
            const isPast = idx < currentEtapaIdx
            const isCurrent = idx === currentEtapaIdx && !isCompleted
            const isFuture = idx > currentEtapaIdx && !isCompleted
            const StageIcon = STAGE_ICONS[etapa.icon] || Circle
            const stepColors = ETAPA_COLORS[etapa.key]

            return (
              <div key={etapa.key} className="flex flex-col items-center flex-1 relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                    isPast || (isCurrent && idx > 0) ? 'bg-primary' : 'bg-border'
                  }`} style={{ left: '-50%', right: '50%' }} />
                )}
                {/* Circle */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isPast
                      ? 'bg-primary text-white'
                      : isCurrent
                        ? `${stepColors?.bg || 'bg-primary/10'} ${stepColors?.text || 'text-primary'} ring-2 ring-primary ring-offset-2 ring-offset-background`
                        : 'bg-muted text-muted-foreground'
                }`}>
                  {isCompleted || isPast ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StageIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className={`mt-1.5 text-[10px] font-medium text-center leading-tight ${
                  isCurrent ? 'text-foreground' : isFuture ? 'text-muted-foreground/60' : 'text-muted-foreground'
                }`}>
                  {etapa.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab('etapa')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'etapa' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {currentEtapa && (() => {
            const Icon = STAGE_ICONS[currentEtapa.icon] || Circle
            return <Icon className="w-4 h-4" />
          })()}
          {isCompleted ? 'Completada' : currentEtapa?.label || 'Etapa'}
        </button>
        <button
          onClick={() => setTab('config')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'config' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          Configuración
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── STAGE CONTENT ── */}
      {tab === 'etapa' && !isCompleted && !isCancelled && (
        <div className="space-y-4">
          {/* Stage description */}
          <div className={`p-4 rounded-xl border-2 ${colors?.border || 'border-border'} ${colors?.bg || ''}`}>
            <p className={`text-sm font-medium ${colors?.text || 'text-foreground'}`}>
              {ETAPA_DESCRIPCION[orden.etapaActual] || ''}
            </p>
          </div>

          {/* Stage-specific panel */}
          {orden.etapaActual === 'Compra de Materiales' && (
            <CompraPanel orden={orden} />
          )}
          {orden.etapaActual === 'Recepcion' && (
            <RecepcionPanel orden={orden} />
          )}
          {(orden.etapaActual === 'Corte' || orden.etapaActual === 'Canteo' || orden.etapaActual === 'Mecanizacion') && (
            <TablerosPanel orden={orden} piezas={piezas} etapa={orden.etapaActual} />
          )}
          {orden.etapaActual === 'QC Proceso' && (
            <QCPanel orden={orden} field="checklistQCProceso" title="QC Proceso" />
          )}
          {orden.etapaActual === 'Ensamble' && (
            <EnsamblePanel orden={orden} />
          )}
          {orden.etapaActual === 'QC Final' && (
            <QCPanel orden={orden} field="checklistQCFinal" title="QC Final" />
          )}

          {/* Advance / Complete button */}
          <div className="flex justify-end gap-3 pt-2">
            {orden.etapaActual === 'QC Final' ? (
              <Button onClick={handleComplete} disabled={advancing} className="gap-2">
                {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Completar Orden — Listo para Instalación
              </Button>
            ) : (
              <Button onClick={handleAdvanceStage} disabled={advancing} className="gap-2">
                {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Completar Etapa — Avanzar a {ETAPAS_PRODUCCION[currentEtapaIdx + 1]?.label || ''}
              </Button>
            )}
          </div>
        </div>
      )}

      {tab === 'etapa' && isCompleted && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">Orden Completada</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Todos los módulos pasaron QC Final y están listos para instalación.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === 'etapa' && isCancelled && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">Orden Cancelada</h3>
          </CardContent>
        </Card>
      )}

      {/* ── CONFIG TAB ── */}
      {tab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración de la Orden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                >
                  {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                >
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Modules in this order */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Módulos ({orden.items.length})</label>
              <div className="space-y-1">
                {orden.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm">
                    <span className="font-medium text-foreground">{item.nombreModulo}</span>
                    {item.tipoModulo && <span className="text-muted-foreground">({item.tipoModulo})</span>}
                    {item.dimensiones && <span className="text-muted-foreground ml-auto">{item.dimensiones}</span>}
                    {item.cantidad > 1 && <span className="text-muted-foreground">×{item.cantidad}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm resize-none"
              />
            </div>
            <div className="flex gap-3 justify-between">
              <Button variant="danger" onClick={handleDeleteOrder}>
                <Trash2 className="w-4 h-4" /> Eliminar Orden
              </Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── STAGE PANELS ──────────────────────────────────────────────────────

function CompraPanel({ orden }: { orden: Orden }) {
  const router = useRouter()
  const [edits, setEdits] = useState<Record<number, Partial<Material>>>({})
  const [saving, setSaving] = useState(false)

  const tableros = orden.materiales.filter(m => m.tipo === 'tablero')
  const cantos = orden.materiales.filter(m => m.tipo === 'canto')
  const herrajes = orden.materiales.filter(m => m.tipo === 'herraje')
  const otros = orden.materiales.filter(m => !['tablero', 'canto', 'herraje'].includes(m.tipo || ''))

  function updateField(id: number, field: string, value: string | number) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const hasChanges = Object.keys(edits).length > 0

  async function handleSave() {
    setSaving(true)
    const updates = Object.entries(edits).map(([id, changes]) => ({
      id: parseInt(id),
      ...changes,
    }))
    await fetch(`/api/produccion/${orden.id}/materiales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    setEdits({})
    router.refresh()
    setSaving(false)
  }

  const totalCost = orden.materiales.reduce((s, m) => s + m.costoTotal, 0)

  if (orden.materiales.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No hay materiales en esta orden.</p>
          <p className="text-xs mt-1">Los materiales se generan automáticamente al importar desde un espacio.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* PDF download link */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{orden.materiales.length} materiales</p>
          <p className="text-xs text-muted-foreground">
            Total estimado: RD${totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <Link href={`/produccion/${orden.id}/lista-compra`} target="_blank">
          <Button variant="outline" className="gap-2">
            <FileDown className="w-4 h-4" />
            PDF Lista de Compra
          </Button>
        </Link>
      </div>

      {/* Material groups */}
      {tableros.length > 0 && (
        <MaterialGroup title="Tableros" materials={tableros} edits={edits} onUpdate={updateField} />
      )}
      {cantos.length > 0 && (
        <MaterialGroup title="Cantos" materials={cantos} edits={edits} onUpdate={updateField} />
      )}
      {herrajes.length > 0 && (
        <MaterialGroup title="Herrajes" materials={herrajes} edits={edits} onUpdate={updateField} />
      )}
      {otros.length > 0 && (
        <MaterialGroup title="Otros" materials={otros} edits={edits} onUpdate={updateField} />
      )}

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Cambios
          </Button>
        </div>
      )}
    </div>
  )
}

function MaterialGroup({
  title,
  materials,
  edits,
  onUpdate,
}: {
  title: string
  materials: Material[]
  edits: Record<number, Partial<Material>>
  onUpdate: (id: number, field: string, value: string | number) => void
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title} ({materials.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-2 px-4 font-medium text-muted-foreground">Material</th>
              <th className="text-center py-2 px-4 font-medium text-muted-foreground">Requerido</th>
              <th className="text-center py-2 px-4 font-medium text-muted-foreground">Comprado</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground">Costo</th>
              <th className="text-center py-2 px-4 font-medium text-muted-foreground">Estado</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => {
              const edit = edits[m.id] || {}
              const comprada = edit.cantidadComprada ?? m.cantidadComprada
              const estado = (edit.estado as string) ?? m.estado

              return (
                <tr key={m.id} className="border-b border-border hover:bg-muted/20">
                  <td className="py-2 px-4">
                    <p className="font-medium text-foreground">{m.nombre}</p>
                    {m.proveedor && <p className="text-xs text-muted-foreground">{m.proveedor}</p>}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span className="font-medium">{m.cantidadRequerida}</span>
                    <span className="text-muted-foreground ml-1">{m.unidad}</span>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={comprada}
                      onChange={(e) => onUpdate(m.id, 'cantidadComprada', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 rounded border border-border bg-input text-foreground text-sm text-center"
                    />
                  </td>
                  <td className="py-2 px-4 text-right text-muted-foreground">
                    RD${m.costoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <select
                      value={estado}
                      onChange={(e) => onUpdate(m.id, 'estado', e.target.value)}
                      className="px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer bg-muted text-foreground"
                    >
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
  )
}

function RecepcionPanel({ orden }: { orden: Orden }) {
  const router = useRouter()
  const [edits, setEdits] = useState<Record<number, Partial<Material>>>({})
  const [saving, setSaving] = useState(false)

  function updateField(id: number, field: string, value: string | number) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const hasChanges = Object.keys(edits).length > 0

  async function handleSave() {
    setSaving(true)
    const updates = Object.entries(edits).map(([id, changes]) => ({
      id: parseInt(id),
      ...changes,
    }))
    await fetch(`/api/produccion/${orden.id}/materiales`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    setEdits({})
    router.refresh()
    setSaving(false)
  }

  const received = orden.materiales.filter(m => m.estado === 'Recibido').length
  const total = orden.materiales.length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted rounded-full h-2.5">
          <div
            className="bg-indigo-500 h-2.5 rounded-full transition-all"
            style={{ width: total > 0 ? `${(received / total) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-sm font-medium text-foreground">{received}/{total} recibidos</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Material</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Tipo</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Comprado</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Recibido</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orden.materiales.map(m => {
                const edit = edits[m.id] || {}
                const recibida = edit.cantidadRecibida ?? m.cantidadRecibida
                const estado = (edit.estado as string) ?? m.estado

                return (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/20">
                    <td className="py-2 px-4 font-medium text-foreground">{m.nombre}</td>
                    <td className="py-2 px-4 text-muted-foreground capitalize">{m.tipo || '-'}</td>
                    <td className="py-2 px-4 text-center">{m.cantidadComprada} {m.unidad}</td>
                    <td className="py-2 px-4 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={recibida}
                        onChange={(e) => updateField(m.id, 'cantidadRecibida', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded border border-border bg-input text-foreground text-sm text-center"
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <select
                        value={estado}
                        onChange={(e) => updateField(m.id, 'estado', e.target.value)}
                        className="px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer bg-muted text-foreground"
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Parcial">Parcial</option>
                        <option value="Recibido">Recibido</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Recepción
          </Button>
        </div>
      )}
    </div>
  )
}

function TablerosPanel({ orden, piezas, etapa }: { orden: Orden; piezas: Pieza[]; etapa: string }) {
  const labels: Record<string, { title: string; desc: string }> = {
    'Corte':         { title: 'Piezas a Cortar', desc: 'Solo tableros. Cortar cada pieza según las dimensiones indicadas.' },
    'Canteo':        { title: 'Piezas a Cantear', desc: 'Aplicar cantos a las piezas cortadas según lo indicado.' },
    'Mecanizacion':  { title: 'Piezas a Mecanizar', desc: 'Perforaciones para bisagras, rieles y otros mecanizados.' },
  }
  const { title, desc } = labels[etapa] || { title: 'Piezas', desc: '' }

  // Group piezas by module
  const byModule = new Map<string, Pieza[]>()
  for (const p of piezas) {
    const key = p.moduloNombre
    if (!byModule.has(key)) byModule.set(key, [])
    byModule.get(key)!.push(p)
  }

  const totalPiezas = piezas.reduce((s, p) => s + p.cantidad, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <span className="text-sm text-muted-foreground">{totalPiezas} piezas total</span>
      </div>

      {piezas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No hay piezas de tablero registradas en los módulos de esta orden.</p>
            <p className="text-xs mt-1">Las piezas se importan del diseño del módulo de melamina.</p>
          </CardContent>
        </Card>
      ) : (
        Array.from(byModule.entries()).map(([moduloName, moduloPiezas]) => (
          <Card key={moduloName}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{moduloName}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Pieza</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Etiqueta</th>
                    <th className="text-center py-2 px-4 font-medium text-muted-foreground">Largo</th>
                    <th className="text-center py-2 px-4 font-medium text-muted-foreground">Ancho</th>
                    <th className="text-center py-2 px-4 font-medium text-muted-foreground">Esp.</th>
                    <th className="text-center py-2 px-4 font-medium text-muted-foreground">Cant.</th>
                    {etapa === 'Canteo' && (
                      <th className="text-left py-2 px-4 font-medium text-muted-foreground">Cantos</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {moduloPiezas.map(p => {
                    let cantos: string[] = []
                    if (etapa === 'Canteo') {
                      try { cantos = JSON.parse(p.tapacanto) } catch { cantos = [] }
                    }
                    return (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                        <td className="py-2 px-4 font-medium text-foreground">{p.nombre}</td>
                        <td className="py-2 px-4 text-muted-foreground">{p.etiqueta}</td>
                        <td className="py-2 px-4 text-center">{p.largo} mm</td>
                        <td className="py-2 px-4 text-center">{p.ancho} mm</td>
                        <td className="py-2 px-4 text-center">{p.espesor} mm</td>
                        <td className="py-2 px-4 text-center font-medium">{p.cantidad}</td>
                        {etapa === 'Canteo' && (
                          <td className="py-2 px-4 text-muted-foreground text-xs">
                            {cantos.length > 0 ? cantos.join(', ') : 'Sin canto'}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function QCPanel({ orden, field, title }: { orden: Orden; field: 'checklistQCProceso' | 'checklistQCFinal'; title: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const checklistJson = field === 'checklistQCProceso' ? orden.checklistQCProceso : orden.checklistQCFinal
  let items: QCItem[] = []
  try { items = checklistJson ? JSON.parse(checklistJson) : [] } catch { items = [] }

  const checkedCount = items.filter(i => i.checked).length
  const allChecked = items.length > 0 && checkedCount === items.length

  async function toggleItem(idx: number) {
    setSaving(true)
    const updated = items.map((item, i) => {
      if (i !== idx) return item
      return {
        ...item,
        checked: !item.checked,
        checkedAt: !item.checked ? new Date().toISOString() : undefined,
      }
    })

    await fetch(`/api/produccion/${orden.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: updated }),
    })

    router.refresh()
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {allChecked ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground" />
            )}
            {title}
            <span className="text-sm text-muted-foreground font-normal">({checkedCount}/{items.length})</span>
          </CardTitle>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((qcItem, idx) => (
          <label
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/30 ${
              qcItem.checked ? 'opacity-70' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={qcItem.checked}
              onChange={() => toggleItem(idx)}
              disabled={saving}
              className="accent-primary w-5 h-5"
            />
            <span className={`text-sm ${qcItem.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {qcItem.item}
            </span>
          </label>
        ))}
        {allChecked && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-3 font-medium">
            ✓ Checklist completado — puede avanzar a la siguiente etapa.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function EnsamblePanel({ orden }: { orden: Orden }) {
  // Show modules + their herrajes from materials
  const herrajes = orden.materiales.filter(m => m.tipo === 'herraje')

  return (
    <div className="space-y-4">
      {/* Modules to assemble */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Módulos a Ensamblar ({orden.items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orden.items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.nombreModulo}</p>
                <p className="text-xs text-muted-foreground">
                  {item.tipoModulo && `${item.tipoModulo} — `}{item.dimensiones}
                </p>
              </div>
              {item.cantidad > 1 && (
                <span className="text-sm text-muted-foreground">×{item.cantidad}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Herrajes to add during assembly */}
      {herrajes.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Herrajes a Instalar ({herrajes.length})</CardTitle>
          </CardHeader>
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
