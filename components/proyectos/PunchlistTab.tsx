'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Check, X, Loader2,
  AlertTriangle, CheckCircle2, Circle, Clock, ShieldCheck, ArrowRight,
} from 'lucide-react'

interface PunchItem {
  id: number
  titulo: string
  descripcion: string | null
  ubicacion: string | null
  categoria: string | null
  prioridad: 'baja' | 'media' | 'alta' | 'critica'
  estado: 'abierto' | 'en_progreso' | 'resuelto' | 'verificado' | 'cerrado'
  asignadoA: string | null
  fechaLimite: string | null
  resolucionNotas: string | null
  verificadoPor: string | null
  resueltoEn: string | null
  verificadoEn: string | null
  createdAt: string
}

const ESTADO_CONFIG: Record<PunchItem['estado'], { label: string; icon: typeof Circle; color: string; bg: string }> = {
  abierto:     { label: 'Abierto',     icon: Circle,       color: 'text-red-700',    bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-300' },
  en_progreso: { label: 'En progreso', icon: Clock,        color: 'text-amber-700',  bg: 'bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  resuelto:    { label: 'Resuelto',    icon: CheckCircle2, color: 'text-blue-700',   bg: 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' },
  verificado:  { label: 'Verificado',  icon: ShieldCheck,  color: 'text-green-700',  bg: 'bg-green-100 dark:bg-green-900/30 dark:text-green-300' },
  cerrado:     { label: 'Cerrado',     icon: Check,        color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-800/50 dark:text-slate-400' },
}

const PRIORIDAD_CONFIG: Record<PunchItem['prioridad'], { label: string; color: string }> = {
  baja:    { label: 'Baja',    color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
  media:   { label: 'Media',   color: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' },
  alta:    { label: 'Alta',    color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  critica: { label: 'Crítica', color: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300' },
}

const CATEGORIAS = ['Pintura', 'Plomería', 'Eléctrico', 'Acabado', 'Carpintería', 'Piso', 'Techo', 'Ventanas', 'Puertas', 'Limpieza', 'Otro']

const emptyForm = { titulo: '', descripcion: '', ubicacion: '', categoria: '', prioridad: 'media', asignadoA: '', fechaLimite: '' }

export function PunchlistTab({ proyectoId }: { proyectoId: number }) {
  const router = useRouter()
  const [items, setItems] = useState<PunchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/punchlist`)
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { fetchData() }, [fetchData])

  function startNew() { setForm(emptyForm); setEditId(null); setShowForm(true); setError(null) }
  function startEdit(item: PunchItem) {
    setForm({
      titulo: item.titulo,
      descripcion: item.descripcion ?? '',
      ubicacion: item.ubicacion ?? '',
      categoria: item.categoria ?? '',
      prioridad: item.prioridad,
      asignadoA: item.asignadoA ?? '',
      fechaLimite: item.fechaLimite ? item.fechaLimite.slice(0, 10) : '',
    })
    setEditId(item.id)
    setShowForm(true)
    setError(null)
  }
  function cancelForm() { setShowForm(false); setEditId(null); setForm(emptyForm); setError(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      const url = editId
        ? `/api/proyectos/${proyectoId}/punchlist/${editId}`
        : `/api/proyectos/${proyectoId}/punchlist`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fechaLimite: form.fechaLimite || null,
          categoria: form.categoria || null,
          asignadoA: form.asignadoA || null,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error') }
      await fetchData(); cancelForm(); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') } finally { setSubmitting(false) }
  }

  async function changeEstado(id: number, estado: PunchItem['estado'], extra?: Record<string, string>) {
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/punchlist/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, ...extra }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Error') }
      await fetchData(); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este item?')) return
    await fetch(`/api/proyectos/${proyectoId}/punchlist/${id}`, { method: 'DELETE' })
    await fetchData(); router.refresh()
  }

  const filteredItems = filtroEstado ? items.filter(i => i.estado === filtroEstado) : items

  // Contadores
  const abiertos = items.filter(i => i.estado === 'abierto' || i.estado === 'en_progreso').length
  const resueltos = items.filter(i => i.estado === 'resuelto').length
  const cerrados = items.filter(i => i.estado === 'verificado' || i.estado === 'cerrado').length

  return (
    <div className="space-y-4">
      {/* Header con contadores */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3">
          <div className="px-4 py-2.5 rounded-xl border border-border bg-card text-center min-w-[100px]">
            <p className="text-2xl font-black text-red-600 tabular-nums">{abiertos}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl border border-border bg-card text-center min-w-[100px]">
            <p className="text-2xl font-black text-blue-600 tabular-nums">{resueltos}</p>
            <p className="text-xs text-muted-foreground">Resueltos</p>
          </div>
          <div className="px-4 py-2.5 rounded-xl border border-border bg-card text-center min-w-[100px]">
            <p className="text-2xl font-black text-green-600 tabular-nums">{cerrados}</p>
            <p className="text-xs text-muted-foreground">Cerrados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="h-9 text-sm border border-border rounded-md px-2 bg-card"
          >
            <option value="">Todos ({items.length})</option>
            {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label} ({items.filter(i => i.estado === k).length})</option>
            ))}
          </select>
          {!showForm && <Button onClick={startNew} size="sm"><Plus className="w-4 h-4" /> Nuevo</Button>}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-border rounded-xl bg-card p-5 space-y-3">
          <h3 className="font-semibold text-foreground">{editId ? 'Editar detalle' : 'Nuevo detalle pendiente'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Título *</Label>
                <Input required value={form.titulo} onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Falta zócalo en baño principal" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ubicación</Label>
                <Input value={form.ubicacion} onChange={(e) => setForm(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Baño 2do piso" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoría</Label>
                <select value={form.categoria} onChange={(e) => setForm(p => ({ ...p, categoria: e.target.value }))} className="w-full h-9 text-sm border border-border rounded-md px-2 bg-card">
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridad</Label>
                <select value={form.prioridad} onChange={(e) => setForm(p => ({ ...p, prioridad: e.target.value }))} className="w-full h-9 text-sm border border-border rounded-md px-2 bg-card">
                  {Object.entries(PRIORIDAD_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Asignado a</Label>
                <Input value={form.asignadoA} onChange={(e) => setForm(p => ({ ...p, asignadoA: e.target.value }))} placeholder="Nombre del responsable" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha límite</Label>
                <Input type="date" value={form.fechaLimite} onChange={(e) => setForm(p => ({ ...p, fechaLimite: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <textarea value={form.descripcion} onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2} className="w-full text-sm border border-border rounded-md px-3 py-2 bg-card resize-none" placeholder="Detalle del pendiente..." />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} size="sm"><Check className="w-3.5 h-3.5" /> {submitting ? 'Guardando...' : 'Guardar'}</Button>
              <Button type="button" variant="secondary" size="sm" onClick={cancelForm}><X className="w-3.5 h-3.5" /> Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...</div>
      ) : filteredItems.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">{items.length === 0 ? 'Sin pendientes registrados' : 'Sin resultados para este filtro'}</p>
          <p className="text-xs text-muted-foreground mt-1">Documenta cada detalle pendiente antes de la entrega al cliente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const ecfg = ESTADO_CONFIG[item.estado]
            const pcfg = PRIORIDAD_CONFIG[item.prioridad]
            const Icon = ecfg.icon
            const vencido = item.fechaLimite && new Date(item.fechaLimite) < new Date() && !['verificado', 'cerrado'].includes(item.estado)
            return (
              <div key={item.id} className={`border rounded-xl bg-card p-4 ${vencido ? 'border-red-300 dark:border-red-800' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-semibold ${item.estado === 'cerrado' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.titulo}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ecfg.bg} ${ecfg.color}`}>
                        <Icon className="w-3 h-3" />{ecfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pcfg.color}`}>{pcfg.label}</span>
                    </div>
                    {item.descripcion && <p className="text-sm text-muted-foreground mt-1">{item.descripcion}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                      {item.ubicacion && <span>📍 {item.ubicacion}</span>}
                      {item.categoria && <span>· {item.categoria}</span>}
                      {item.asignadoA && <span>· Asignado: {item.asignadoA}</span>}
                      {item.fechaLimite && (
                        <span className={vencido ? 'text-red-600 font-semibold' : ''}>
                          · {vencido ? 'Vencido' : 'Límite'}: {formatDate(item.fechaLimite)}
                        </span>
                      )}
                    </div>
                    {item.resolucionNotas && <p className="text-xs text-muted-foreground/80 italic mt-1">Resolución: {item.resolucionNotas}</p>}
                    {item.verificadoPor && <p className="text-xs text-green-600 mt-1">Verificado por: {item.verificadoPor} el {item.verificadoEn ? formatDate(item.verificadoEn) : ''}</p>}
                  </div>
                </div>

                {/* Acciones de flujo */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                  {item.estado === 'abierto' && (
                    <Button size="sm" variant="secondary" onClick={() => changeEstado(item.id, 'en_progreso')}>
                      <ArrowRight className="w-3.5 h-3.5" /> En progreso
                    </Button>
                  )}
                  {(item.estado === 'abierto' || item.estado === 'en_progreso') && (
                    <Button size="sm" onClick={() => {
                      const notas = prompt('Notas de resolución (opcional):')
                      if (notas !== null) changeEstado(item.id, 'resuelto', { resolucionNotas: notas || undefined } as Record<string, string>)
                    }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Marcar resuelto
                    </Button>
                  )}
                  {item.estado === 'resuelto' && (
                    <Button size="sm" onClick={() => {
                      const por = prompt('Verificado por (nombre del cliente o PM):')
                      if (por !== null) changeEstado(item.id, 'verificado', { verificadoPor: por || undefined } as Record<string, string>)
                    }}>
                      <ShieldCheck className="w-3.5 h-3.5" /> Verificar
                    </Button>
                  )}
                  {item.estado === 'verificado' && (
                    <Button size="sm" variant="secondary" onClick={() => changeEstado(item.id, 'cerrado')}>
                      <Check className="w-3.5 h-3.5" /> Cerrar
                    </Button>
                  )}
                  {item.estado === 'resuelto' && (
                    <Button size="sm" variant="secondary" onClick={() => changeEstado(item.id, 'abierto')}>
                      <Circle className="w-3.5 h-3.5" /> Reabrir
                    </Button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => startEdit(item)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
