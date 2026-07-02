'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ETAPAS_PRODUCCION, ETAPA_COLORS, ESTADO_COLORS, PRIORIDAD_COLORS,
  PRIORIDADES, ESTADOS_ORDEN, ETAPA_ORDER, ETAPA_DESCRIPCION, HORAS_ESTIMADAS,
} from '@/lib/produccion'
import {
  ArrowLeft, ArrowRight, ShieldCheck, Settings, Trash2, Save,
  Loader2, Check, AlertCircle, CheckCircle2, Circle,
  Clock,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSmartBack } from '@/components/ui/back-button'
import {
  type Props,
  STAGE_ICONS, parseEtapasLog, formatDuration,
} from './orden-produccion-core'
import { CompraPanel, RecepcionPanel, CortePanel, CanteoPanel, MecanizacionPanel, QCPanel, EnsamblePanel } from './OrdenEtapasPaneles'
import { useToast } from '@/components/ui/toast'

export function OrdenProduccionDetail({ orden, piezas }: Props) {
  const router = useRouter()
  const goBack = useSmartBack('/produccion')
  const toast = useToast()
  const [tab, setTab] = useState<'etapa' | 'tiempos' | 'config'>('etapa')
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState(false)

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
    setDeletingOrder(true)
    try {
      await fetch(`/api/produccion/${orden.id}`, { method: 'DELETE' })
      toast.exito('Orden de producción eliminada')
      router.push('/produccion?msg=eliminado')
    } finally {
      setDeletingOrder(false)
      setConfirmarBorrar(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={goBack} aria-label="Volver"><ArrowLeft className="w-4 h-4" /></Button>
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
                <span className={`mt-1.5 text-2xs font-medium text-center leading-tight ${
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
              <Button variant="danger" onClick={() => setConfirmarBorrar(true)}><Trash2 className="w-4 h-4" /> Eliminar</Button>
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        abierto={confirmarBorrar}
        titulo="¿Eliminar esta orden y todos sus items?"
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={deletingOrder}
        onConfirmar={handleDeleteOrder}
        onCancelar={() => setConfirmarBorrar(false)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// STAGE PANELS
// ═══════════════════════════════════════════════════════════════════════

