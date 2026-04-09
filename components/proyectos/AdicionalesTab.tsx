'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Check, X, FileText, Loader2,
  CheckCircle2, XCircle, Clock, Receipt,
} from 'lucide-react'

interface Adicional {
  id: number
  numero: string | null
  titulo: string
  descripcion: string | null
  monto: number
  estado: 'propuesto' | 'aprobado' | 'rechazado' | 'facturado'
  fechaPropuesta: string
  fechaAprobacion: string | null
  aprobadoPor: string | null
  motivoRechazo: string | null
  notas: string | null
}

const ESTADO_CONFIG: Record<Adicional['estado'], { label: string; icon: typeof Clock; color: string; bg: string }> = {
  propuesto:  { label: 'Propuesto',  icon: Clock,        color: 'text-amber-700',  bg: 'bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  aprobado:   { label: 'Aprobado',   icon: CheckCircle2, color: 'text-green-700',  bg: 'bg-green-100 dark:bg-green-900/30 dark:text-green-300' },
  rechazado:  { label: 'Rechazado',  icon: XCircle,      color: 'text-red-700',    bg: 'bg-red-100 dark:bg-red-900/30 dark:text-red-300' },
  facturado:  { label: 'Facturado',  icon: Receipt,      color: 'text-blue-700',   bg: 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' },
}

const emptyForm = { numero: '', titulo: '', descripcion: '', monto: '', notas: '' }

export function AdicionalesTab({ proyectoId }: { proyectoId: number }) {
  const router = useRouter()
  const [adicionales, setAdicionales] = useState<Adicional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/adicionales`)
      if (!res.ok) throw new Error('Error al cargar adicionales')
      setAdicionales(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { fetchData() }, [fetchData])

  function startNew() {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
  }

  function startEdit(a: Adicional) {
    setForm({
      numero: a.numero ?? '',
      titulo: a.titulo,
      descripcion: a.descripcion ?? '',
      monto: String(a.monto),
      notas: a.notas ?? '',
    })
    setEditId(a.id)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const url = editId
        ? `/api/proyectos/${proyectoId}/adicionales/${editId}`
        : `/api/proyectos/${proyectoId}/adicionales`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: form.numero || null,
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          monto: parseFloat(form.monto) || 0,
          notas: form.notas || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al guardar')
      }
      await fetchData()
      cancelForm()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  async function changeEstado(id: number, nuevoEstado: Adicional['estado'], extra?: { aprobadoPor?: string; motivoRechazo?: string }) {
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/adicionales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar')
      }
      await fetchData()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este adicional? Esta acción no se puede deshacer.')) return
    setError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/adicionales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      await fetchData()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  // Totales por estado
  const totalAprobado = adicionales.filter(a => a.estado === 'aprobado' || a.estado === 'facturado').reduce((s, a) => s + a.monto, 0)
  const totalPropuesto = adicionales.filter(a => a.estado === 'propuesto').reduce((s, a) => s + a.monto, 0)
  const cantAprobados = adicionales.filter(a => a.estado === 'aprobado' || a.estado === 'facturado').length
  const cantPropuestos = adicionales.filter(a => a.estado === 'propuesto').length

  return (
    <div className="space-y-4">

      {/* Header con totales */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-3">
          <div className="px-4 py-3 rounded-xl border border-border bg-card min-w-[180px]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aprobados</p>
            <p className="text-xl font-black text-green-700 dark:text-green-400 tabular-nums">{formatCurrency(totalAprobado)}</p>
            <p className="text-xs text-muted-foreground">{cantAprobados} {cantAprobados === 1 ? 'adicional' : 'adicionales'}</p>
          </div>
          <div className="px-4 py-3 rounded-xl border border-border bg-card min-w-[180px]">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">En propuesta</p>
            <p className="text-xl font-black text-amber-600 tabular-nums">{formatCurrency(totalPropuesto)}</p>
            <p className="text-xs text-muted-foreground">{cantPropuestos} pendientes de aprobación</p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={startNew}><Plus className="w-4 h-4" /> Nuevo adicional</Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-border rounded-xl bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {editId ? 'Editar adicional' : 'Nuevo adicional'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nº (opcional)</Label>
                <Input value={form.numero} onChange={(e) => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="AD-001" className="h-9 text-sm" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Título *</Label>
                <Input required value={form.titulo} onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Cambio de piso a porcelanato" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto (RD$) *</Label>
                <Input required type="number" min="0" step="0.01" value={form.monto} onChange={(e) => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="0.00" className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm(p => ({ ...p, descripcion: e.target.value }))}
                rows={2}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-card resize-none"
                placeholder="Detalle del trabajo extra solicitado..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas internas</Label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm(p => ({ ...p, notas: e.target.value }))}
                rows={2}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-card resize-none"
                placeholder="Notas no visibles para el cliente..."
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                <Check className="w-3.5 h-3.5" /> {submitting ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : adicionales.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Sin adicionales registrados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Documenta cualquier trabajo extra solicitado por el cliente para evitar pérdidas.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {adicionales.map((a) => {
            const cfg = ESTADO_CONFIG[a.estado]
            const Icon = cfg.icon
            return (
              <div key={a.id} className="border border-border rounded-xl bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.numero && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{a.numero}</span>
                      )}
                      <h4 className="font-semibold text-foreground">{a.titulo}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    {a.descripcion && (
                      <p className="text-sm text-muted-foreground mt-1">{a.descripcion}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Propuesto el {formatDate(a.fechaPropuesta)}</span>
                      {a.fechaAprobacion && <span>· Aprobado el {formatDate(a.fechaAprobacion)}</span>}
                      {a.aprobadoPor && <span>· por {a.aprobadoPor}</span>}
                    </div>
                    {a.motivoRechazo && (
                      <p className="text-xs text-red-600 mt-1">Motivo del rechazo: {a.motivoRechazo}</p>
                    )}
                    {a.notas && (
                      <p className="text-xs text-muted-foreground/80 italic mt-1">Notas: {a.notas}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-foreground tabular-nums">{formatCurrency(a.monto)}</p>
                  </div>
                </div>

                {/* Acciones de estado */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                  {a.estado === 'propuesto' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          const por = prompt('Nombre del cliente / persona que aprueba:')
                          if (por !== null) changeEstado(a.id, 'aprobado', { aprobadoPor: por || undefined })
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const motivo = prompt('Motivo del rechazo (opcional):')
                          if (motivo !== null) changeEstado(a.id, 'rechazado', { motivoRechazo: motivo || undefined })
                        }}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </Button>
                    </>
                  )}
                  {a.estado === 'aprobado' && (
                    <Button size="sm" variant="secondary" onClick={() => changeEstado(a.id, 'facturado')}>
                      <Receipt className="w-3.5 h-3.5" /> Marcar facturado
                    </Button>
                  )}
                  {a.estado === 'rechazado' && (
                    <Button size="sm" variant="secondary" onClick={() => changeEstado(a.id, 'propuesto')}>
                      <Clock className="w-3.5 h-3.5" /> Reactivar
                    </Button>
                  )}
                  <button
                    onClick={() => startEdit(a)}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
