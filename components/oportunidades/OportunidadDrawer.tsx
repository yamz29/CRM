'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Pencil, Trophy, XCircle, FileText, Phone, MessageCircle,
  Users, MapPin, Mail, StickyNote, Plus, ExternalLink, CheckCircle, Link2,
  ListTodo, Square, CheckSquare, Clock, AlertTriangle, Archive, ArchiveRestore, Star,
  FolderOpen, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { ETAPAS, type Oportunidad, type PresupuestoOpcion } from './PipelineClient'
import { SharePointBrowser } from '@/components/documentos/SharePointBrowser'
import { sanitizeFolderName } from '@/lib/sharepoint'

interface ActividadCRM {
  id: number
  tipo: string
  descripcion: string
  fecha: string
  createdAt: string
}

interface TareaOportunidad {
  id: number
  titulo: string
  estado: string
  prioridad: string
  etapaPipeline: string | null
  fechaLimite: string | null
}

interface Props {
  oportunidad: Oportunidad
  presupuestosDisponibles: PresupuestoOpcion[]
  onClose: () => void
  onEdit: (op: Oportunidad) => void
  onSaved: () => void
}

const TIPO_ACTIVIDAD_ICONS: Record<string, React.ReactNode> = {
  Llamada:  <Phone className="w-3.5 h-3.5" />,
  WhatsApp: <MessageCircle className="w-3.5 h-3.5" />,
  Reunión:  <Users className="w-3.5 h-3.5" />,
  Visita:   <MapPin className="w-3.5 h-3.5" />,
  Correo:   <Mail className="w-3.5 h-3.5" />,
  Nota:     <StickyNote className="w-3.5 h-3.5" />,
}

const ESTADO_PRES_COLORS: Record<string, string> = {
  Borrador: 'bg-muted text-muted-foreground',
  Enviado:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Aprobado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Rechazado:'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

// ── Ganar Modal ───────────────────────────────────────────────────────────────

function GanarModal({ oportunidad, onClose, onGanada }: { oportunidad: Oportunidad; onClose: () => void; onGanada: (proyectoId: number) => void }) {
  const [nombreProyecto, setNombreProyecto] = useState(oportunidad.nombre)
  const [tipoProyecto, setTipoProyecto]     = useState('Remodelación')
  const [saving, setSaving]                 = useState(false)

  async function handleGanar() {
    if (!nombreProyecto) return
    setSaving(true)
    const res = await fetch(`/api/oportunidades/${oportunidad.id}/ganar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreProyecto, tipoProyecto }),
    })
    if (res.ok) {
      const data = await res.json()
      onGanada(data.proyectoId)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Trophy className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-foreground">¡Oportunidad ganada!</h3>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Se creará un proyecto automáticamente vinculado a esta oportunidad.</p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre del proyecto</label>
            <input
              value={nombreProyecto}
              onChange={(e) => setNombreProyecto(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de proyecto</label>
            <select
              value={tipoProyecto}
              onChange={(e) => setTipoProyecto(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {['Remodelación', 'Construcción', 'Diseño interior', 'Instalación', 'Mantenimiento', 'Consultoría', 'Otro'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleGanar} disabled={saving || !nombreProyecto} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-1" />
              {saving ? 'Creando...' : 'Crear proyecto'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function OportunidadDrawer({ oportunidad, presupuestosDisponibles, onClose, onEdit, onSaved }: Props) {
  const router = useRouter()
  const [actividades, setActividades] = useState<ActividadCRM[]>([])
  const [actLoaded, setActLoaded]     = useState(false)
  const [tareas, setTareas]           = useState<TareaOportunidad[]>([])
  const [tareasLoaded, setTareasLoaded] = useState(false)
  const [newTareaTitle, setNewTareaTitle] = useState('')
  const [addingTarea, setAddingTarea] = useState(false)
  const [newTipo, setNewTipo]         = useState('Nota')
  const [newDesc, setNewDesc]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [ganarOpen, setGanarOpen]       = useState(false)
  const [perdidaOpen, setPerdidaOpen]   = useState(false)
  const [motivoPerdida, setMotivoPerdida] = useState('')
  const [vincularOpen, setVincularOpen] = useState(false)
  const [presupuestoAVincular, setPresupuestoAVincular] = useState('')
  const [vinculando, setVinculando]     = useState(false)
  const [docs, setDocs] = useState<{ id: number; nombre: string; categoria: string; url: string; createdAt: string }[]>([])
  const [docsLoaded, setDocsLoaded] = useState(false)

  const etapaCfg = ETAPAS.find((e) => e.key === oportunidad.etapa)

  // Load activities, tasks and documents on mount
  useEffect(() => {
    fetch(`/api/oportunidades/${oportunidad.id}/actividades`)
      .then((r) => r.json())
      .then((data) => { setActividades(data); setActLoaded(true) })
    fetch(`/api/oportunidades/${oportunidad.id}/tareas`)
      .then((r) => r.json())
      .then((data) => { setTareas(data); setTareasLoaded(true) })
    fetch(`/api/documentos?oportunidadId=${oportunidad.id}`)
      .then((r) => r.json())
      .then((data) => { setDocs(data); setDocsLoaded(true) })
  }, [oportunidad.id])

  async function addActividad() {
    if (!newDesc.trim()) return
    setSaving(true)
    const res = await fetch(`/api/oportunidades/${oportunidad.id}/actividades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: newTipo, descripcion: newDesc }),
    })
    if (res.ok) {
      const act = await res.json()
      setActividades((prev) => [act, ...prev])
      setNewDesc('')
      onSaved()
    }
    setSaving(false)
  }

  async function vincularPresupuesto() {
    if (!presupuestoAVincular) return
    setVinculando(true)
    await fetch(`/api/oportunidades/${oportunidad.id}/presupuestos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presupuestoId: parseInt(presupuestoAVincular) }),
    })
    setVinculando(false)
    setVincularOpen(false)
    setPresupuestoAVincular('')
    onSaved()
  }

  async function desvincularPresupuesto(presupuestoId: number) {
    await fetch(`/api/oportunidades/${oportunidad.id}/presupuestos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presupuestoId }),
    })
    onSaved()
  }

  async function addTareaRapida() {
    if (!newTareaTitle.trim()) return
    setAddingTarea(true)
    const res = await fetch(`/api/oportunidades/${oportunidad.id}/tareas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: newTareaTitle.trim() }),
    })
    if (res.ok) {
      const tarea = await res.json()
      setTareas(prev => [...prev, tarea])
      setNewTareaTitle('')
    }
    setAddingTarea(false)
  }

  async function toggleTarea(tareaId: number, completar: boolean) {
    const nuevoEstado = completar ? 'Completada' : 'Pendiente'
    await fetch(`/api/tareas/${tareaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado, _patch: true }),
    })
    setTareas(prev => prev.map(t =>
      t.id === tareaId ? { ...t, estado: nuevoEstado } : t
    ))
  }

  async function handleArchivar(archivar: boolean) {
    await fetch(`/api/oportunidades/${oportunidad.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _archivar: archivar }),
    })
    onSaved()
    onClose()
  }

  async function marcarPerdida() {
    await fetch(`/api/oportunidades/${oportunidad.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa: 'Perdido', motivoPerdida: motivoPerdida || null }),
    })
    setPerdidaOpen(false)
    onSaved()
    onClose()
  }

  function handleGanada(proyectoId: number) {
    setGanarOpen(false)
    onSaved()
    onClose()
    router.push(`/proyectos/${proyectoId}`)
  }

  const isActive = !['Ganado', 'Perdido'].includes(oportunidad.etapa)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground leading-tight">{oportunidad.nombre}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{oportunidad.cliente.nombre}</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${etapaCfg?.light ?? ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${etapaCfg?.color}`} />
            {oportunidad.etapa}
          </span>
          <button
            onClick={async () => {
              await fetch(`/api/oportunidades/${oportunidad.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urgente: !oportunidad.urgente }),
              })
              onSaved()
            }}
            className={`shrink-0 transition-colors ${oportunidad.urgente ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
            title={oportunidad.urgente ? 'Quitar urgente' : 'Marcar urgente'}
          >
            <Star className={`w-4 h-4 ${oportunidad.urgente ? 'fill-amber-500' : ''}`} />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Datos generales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Valor estimado</p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {oportunidad.valor ? formatCurrency(oportunidad.valor) : '—'}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Probabilidad</p>
              <p className="text-sm font-bold text-foreground">
                {oportunidad.probabilidad ? `${oportunidad.probabilidad}%` : '—'}
              </p>
            </div>
            {oportunidad.responsable && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Responsable</p>
                <p className="text-sm text-foreground">{oportunidad.responsable}</p>
              </div>
            )}
            {oportunidad.fechaCierreEst && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Cierre estimado</p>
                <p className="text-sm text-foreground">
                  {new Date(oportunidad.fechaCierreEst).toLocaleDateString('es-DO')}
                </p>
              </div>
            )}
          </div>

          {oportunidad.notas && (
            <div className="bg-muted/20 border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              <p className="text-sm text-foreground">{oportunidad.notas}</p>
            </div>
          )}

          {oportunidad.motivoPerdida && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs text-red-600 dark:text-red-400 mb-1">Motivo de pérdida</p>
              <p className="text-sm text-foreground">{oportunidad.motivoPerdida}</p>
            </div>
          )}

          {oportunidad.proyecto && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 dark:text-green-400 mb-0.5">Proyecto creado</p>
                <p className="text-sm font-medium text-foreground">{oportunidad.proyecto.nombre}</p>
              </div>
              <a
                href={`/proyectos/${oportunidad.proyecto.id}`}
                className="text-green-600 hover:text-green-700 dark:text-green-400"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Cotizaciones vinculadas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cotizaciones</p>
              <div className="flex items-center gap-2">
                {presupuestosDisponibles.length > 0 && isActive && (
                  <button
                    onClick={() => setVincularOpen((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Link2 className="w-3 h-3" /> Vincular existente
                  </button>
                )}
                <a
                  href={`/presupuestos/nuevo-v2?clienteId=${oportunidad.clienteId}&oportunidadId=${oportunidad.id}`}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Nueva cotización
                </a>
              </div>
            </div>

            {/* Panel vincular existente */}
            {vincularOpen && (
              <div className="mb-2 p-3 bg-muted/30 border border-border rounded-lg space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Selecciona una cotización del cliente:</p>
                <div className="flex gap-2">
                  <select
                    value={presupuestoAVincular}
                    onChange={(e) => setPresupuestoAVincular(e.target.value)}
                    className="flex-1 h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground"
                  >
                    <option value="">Seleccionar...</option>
                    {presupuestosDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.numero} — {p.estado} — {formatCurrency(p.total)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={vincularPresupuesto}
                    disabled={!presupuestoAVincular || vinculando}
                    className="h-8 px-3 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    {vinculando ? '...' : 'Vincular'}
                  </button>
                  <button
                    onClick={() => { setVincularOpen(false); setPresupuestoAVincular('') }}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {oportunidad.presupuestos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin cotizaciones aún.</p>
            ) : (
              <div className="space-y-1.5">
                {oportunidad.presupuestos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-muted/20 border border-border rounded-lg px-3 py-2 group">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{p.numero}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${ESTADO_PRES_COLORS[p.estado] ?? 'bg-muted text-muted-foreground'}`}>
                        {p.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(p.total)}</span>
                      <a href={`/presupuestos/${p.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {isActive && (
                        <button
                          onClick={() => desvincularPresupuesto(p.id)}
                          title="Desvincular"
                          className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tareas del pipeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tareas</p>
              {tareasLoaded && tareas.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {tareas.filter(t => t.estado === 'Completada').length}/{tareas.length} completadas
                </span>
              )}
            </div>

            {!tareasLoaded ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : (
              <>
                {tareas.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {tareas.map((t) => {
                      const done = t.estado === 'Completada'
                      const vencida = t.fechaLimite && new Date(t.fechaLimite) < new Date() && !done
                      return (
                        <div key={t.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors ${done ? 'opacity-60' : 'hover:bg-muted/30'}`}>
                          <button
                            onClick={() => toggleTarea(t.id, !done)}
                            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                          >
                            {done
                              ? <CheckSquare className="w-4 h-4 text-green-500" />
                              : <Square className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-tight ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {t.titulo}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {t.etapaPipeline && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {t.etapaPipeline}
                                </span>
                              )}
                              {t.prioridad === 'Alta' && (
                                <span className="text-[10px] text-red-500 font-medium">Alta</span>
                              )}
                              {t.fechaLimite && (
                                <span className={`text-[10px] flex items-center gap-0.5 ${vencida ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                  {vencida && <AlertTriangle className="w-2.5 h-2.5" />}
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(t.fechaLimite).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add task inline */}
                {isActive && (
                  <div className="flex gap-2">
                    <input
                      value={newTareaTitle}
                      onChange={(e) => setNewTareaTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTareaRapida()}
                      placeholder="Agregar tarea..."
                      className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={addTareaRapida}
                      disabled={addingTarea || !newTareaTitle.trim()}
                      className="h-8 w-8 flex items-center justify-center bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {tareas.length === 0 && !isActive && (
                  <p className="text-xs text-muted-foreground">Sin tareas registradas.</p>
                )}
              </>
            )}
          </div>

          {/* Documentos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documentos</p>
              <a href="/documentos" className="text-xs text-primary hover:underline">Ver todos</a>
            </div>
            {!docsLoaded ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : docs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin documentos vinculados.</p>
            ) : (
              <div className="space-y-1">
                {docs.map((d: { id: number; nombre: string; categoria: string; url: string; createdAt: string }) => (
                  <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 group">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-foreground hover:text-primary transition-colors truncate block">
                        {d.nombre}
                      </a>
                      <span className="text-[10px] text-muted-foreground">{d.categoria}</span>
                    </div>
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* SharePoint browser embebido */}
            <div className="mt-3 border border-border rounded-lg overflow-hidden" style={{ height: 320 }}>
              <SharePointBrowser
                compact
                allowUpload
                rootPath={sanitizeFolderName(oportunidad.cliente.nombre)}
                oportunidadId={oportunidad.id}
                onRegisterFile={(item, shareUrl) => {
                  // Auto-register document in CRM
                  fetch('/api/documentos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      nombre: item.name.replace(/\.[^.]+$/, ''),
                      url: shareUrl,
                      oportunidadId: oportunidad.id,
                      tamanioRef: item.size ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : null,
                    }),
                  }).then(() => {
                    // Refresh docs
                    fetch(`/api/documentos?oportunidadId=${oportunidad.id}`)
                      .then(r => r.json())
                      .then(data => setDocs(data))
                  })
                }}
              />
            </div>
          </div>

          {/* Actividades */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actividades</p>

            {/* Add activity */}
            {isActive && (
              <div className="flex gap-2 mb-3">
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value)}
                  className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground shrink-0"
                >
                  {Object.keys(TIPO_ACTIVIDAD_ICONS).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addActividad()}
                  placeholder="Descripción de la actividad..."
                  className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={addActividad}
                  disabled={saving || !newDesc.trim()}
                  className="h-8 w-8 flex items-center justify-center bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Timeline */}
            {!actLoaded ? (
              <p className="text-xs text-muted-foreground">Cargando...</p>
            ) : actividades.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin actividades registradas.</p>
            ) : (
              <div className="space-y-2">
                {actividades.map((act) => (
                  <div key={act.id} className="flex gap-2.5">
                    <div className="mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      {TIPO_ACTIVIDAD_ICONS[act.tipo] ?? <StickyNote className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{act.tipo}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(act.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{act.descripcion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(oportunidad)} className="gap-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleArchivar(!oportunidad.archivada)}
            className="gap-1.5 text-muted-foreground"
          >
            {oportunidad.archivada
              ? <><ArchiveRestore className="w-3.5 h-3.5 text-amber-500" /> Desarchivar</>
              : <><Archive className="w-3.5 h-3.5" /> Archivar</>}
          </Button>
          <div className="flex-1" />
          {isActive && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPerdidaOpen(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" /> Perdida
              </Button>
              <Button
                size="sm"
                onClick={() => setGanarOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
              >
                <Trophy className="w-3.5 h-3.5" /> Ganada
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Ganar modal */}
      {ganarOpen && (
        <GanarModal oportunidad={oportunidad} onClose={() => setGanarOpen(false)} onGanada={handleGanada} />
      )}

      {/* Perdida confirm */}
      {perdidaOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-foreground">Marcar como perdida</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Motivo (opcional)</label>
              <input
                value={motivoPerdida}
                onChange={(e) => setMotivoPerdida(e.target.value)}
                placeholder="ej: Precio, decidió otro proveedor..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPerdidaOpen(false)}>Cancelar</Button>
              <Button onClick={marcarPerdida} className="bg-red-600 hover:bg-red-700 text-white">Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
