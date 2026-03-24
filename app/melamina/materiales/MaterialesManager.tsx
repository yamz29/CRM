'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

type Tipo = 'tablero' | 'canto' | 'herraje'

interface Material {
  id: number
  tipo: string
  nombre: string
  codigo: string | null
  marca: string | null
  proveedor: string | null
  precio: number
  moneda: string
  unidad: string
  anchoMm: number | null
  largoMm: number | null
  espesorMm: number | null
  observaciones: string | null
}

interface FormState {
  tipo: Tipo
  nombre: string
  codigo: string
  marca: string
  proveedor: string
  precio: string
  unidad: string
  anchoMm: string
  largoMm: string
  espesorMm: string
  observaciones: string
}

const emptyForm = (tipo: Tipo): FormState => ({
  tipo,
  nombre: '',
  codigo: '',
  marca: '',
  proveedor: '',
  precio: '',
  unidad: tipo === 'tablero' ? 'pl' : tipo === 'canto' ? 'rollo' : 'ud',
  anchoMm: '',
  largoMm: '',
  espesorMm: '',
  observaciones: '',
})

const TABS: { key: Tipo; label: string; desc: string }[] = [
  { key: 'tablero', label: 'Tableros', desc: 'Planchas de melamina, MDF, HDF, etc.' },
  { key: 'canto', label: 'Cantos', desc: 'Tapacanto PVC, ABS, melanina' },
  { key: 'herraje', label: 'Herrajes', desc: 'Bisagras, correderas, jaladeras, etc.' },
]

const inputCls = 'border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

function dimLabel(m: Material) {
  if (m.tipo === 'tablero') {
    const parts = []
    if (m.anchoMm) parts.push(`${m.anchoMm}mm`)
    if (m.largoMm) parts.push(`${m.largoMm}mm`)
    if (m.espesorMm) parts.push(`e${m.espesorMm}mm`)
    return parts.join(' × ') || '—'
  }
  if (m.tipo === 'canto') {
    const parts = []
    if (m.anchoMm) parts.push(`${m.anchoMm}mm ancho`)
    if (m.espesorMm) parts.push(`${m.espesorMm}mm esp.`)
    return parts.join(', ') || '—'
  }
  return '—'
}

export function MaterialesManager({ initialMateriales }: { initialMateriales: Material[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tipo>('tablero')
  const [materiales, setMateriales] = useState<Material[]>(initialMateriales)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm('tablero'))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byTipo = materiales.filter((m) => m.tipo === tab)

  function startNew() {
    setForm(emptyForm(tab))
    setShowForm(true)
    setEditingId(null)
    setError(null)
  }

  function startEdit(m: Material) {
    setEditingId(m.id)
    setEditForm({
      tipo: m.tipo as Tipo,
      nombre: m.nombre,
      codigo: m.codigo || '',
      marca: m.marca || '',
      proveedor: m.proveedor || '',
      precio: String(m.precio || ''),
      unidad: m.unidad,
      anchoMm: m.anchoMm != null ? String(m.anchoMm) : '',
      largoMm: m.largoMm != null ? String(m.largoMm) : '',
      espesorMm: m.espesorMm != null ? String(m.espesorMm) : '',
      observaciones: m.observaciones || '',
    })
    setShowForm(false)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
  }

  function setF(f: FormState, key: keyof FormState, val: string): FormState {
    return { ...f, [key]: val }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/melamina/materiales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tab,
          nombre: form.nombre.trim(),
          codigo: form.codigo || null,
          marca: form.marca || null,
          proveedor: form.proveedor || null,
          precio: parseFloat(form.precio) || 0,
          unidad: form.unidad,
          anchoMm: form.anchoMm ? parseFloat(form.anchoMm) : null,
          largoMm: form.largoMm ? parseFloat(form.largoMm) : null,
          espesorMm: form.espesorMm ? parseFloat(form.espesorMm) : null,
          observaciones: form.observaciones || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error')
      const created = await res.json()
      setMateriales((prev) => [created, ...prev])
      setShowForm(false)
      setForm(emptyForm(tab))
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: number) {
    if (!editForm || !editForm.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/melamina/materiales/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: editForm.tipo,
          nombre: editForm.nombre.trim(),
          codigo: editForm.codigo || null,
          marca: editForm.marca || null,
          proveedor: editForm.proveedor || null,
          precio: parseFloat(editForm.precio) || 0,
          unidad: editForm.unidad,
          anchoMm: editForm.anchoMm ? parseFloat(editForm.anchoMm) : null,
          largoMm: editForm.largoMm ? parseFloat(editForm.largoMm) : null,
          espesorMm: editForm.espesorMm ? parseFloat(editForm.espesorMm) : null,
          observaciones: editForm.observaciones || null,
          activo: true,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error')
      const updated = await res.json()
      setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)))
      setEditingId(null)
      setEditForm(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return
    try {
      const res = await fetch(`/api/melamina/materiales/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setMateriales((prev) => prev.filter((m) => m.id !== id))
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const tabInfo = TABS.find((t) => t.key === tab)!

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setShowForm(false); setEditingId(null) }}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            <span className="ml-1 text-xs text-slate-400">
              ({materiales.filter((m) => m.tipo === t.key).length})
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">{tabInfo.label}</p>
            <p className="text-xs text-slate-400">{tabInfo.desc}</p>
          </div>
          <Button size="sm" onClick={startNew}>
            <Plus className="w-3.5 h-3.5" /> Agregar {tabInfo.label.slice(0, -1)}
          </Button>
        </div>

        {/* New row form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-blue-50 border-b border-blue-200">
            <FormRow
              f={form}
              tipo={tab}
              setF={(k, v) => setForm((prev) => setF(prev, k, v))}
              onCancel={() => { setShowForm(false); setError(null) }}
              onSave={() => {}}
              saving={saving}
              isNew
            />
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Código</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Marca</th>
                {tab === 'tablero' && (
                  <>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Ancho (mm)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Largo (mm)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Esp. (mm)</th>
                  </>
                )}
                {tab === 'canto' && (
                  <>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Ancho (mm)</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Esp. (mm)</th>
                  </>
                )}
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Precio</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidad</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Proveedor</th>
                <th className="px-3 py-2.5" style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byTipo.length === 0 && !showForm && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No hay {tabInfo.label.toLowerCase()} registrados.
                  </td>
                </tr>
              )}
              {byTipo.map((m) =>
                editingId === m.id && editForm ? (
                  <tr key={m.id} className="bg-amber-50">
                    <EditRow
                      f={editForm}
                      tipo={tab}
                      setF={(k, v) => setEditForm((prev) => prev ? setF(prev, k, v) : prev)}
                      onCancel={cancelEdit}
                      onSave={() => handleUpdate(m.id)}
                      saving={saving}
                    />
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-slate-50/50 group">
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {m.nombre}
                      {m.observaciones && (
                        <p className="text-xs text-slate-400 font-normal">{m.observaciones}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{m.codigo || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{m.marca || '—'}</td>
                    {tab === 'tablero' && (
                      <>
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">{m.anchoMm ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">{m.largoMm ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">{m.espesorMm ?? '—'}</td>
                      </>
                    )}
                    {tab === 'canto' && (
                      <>
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">{m.anchoMm ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">{m.espesorMm ?? '—'}</td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800 font-mono text-xs">
                      {formatCurrency(m.precio)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{m.unidad}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{m.proveedor || '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(m)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.nombre)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Inline form row for new entry ────────────────────────────────────────────

function FormRow({
  f, tipo, setF, onCancel, onSave, saving, isNew,
}: {
  f: FormState
  tipo: Tipo
  setF: (k: keyof FormState, v: string) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  isNew?: boolean
}) {
  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-3 items-end">
      <div className="col-span-3">
        <label className="block text-xs text-blue-700 font-medium mb-1">Nombre *</label>
        <input className={inputCls} value={f.nombre} onChange={(e) => setF('nombre', e.target.value)} placeholder="Nombre" autoFocus />
      </div>
      <div className="col-span-1">
        <label className="block text-xs text-blue-700 font-medium mb-1">Código</label>
        <input className={inputCls} value={f.codigo} onChange={(e) => setF('codigo', e.target.value)} placeholder="Código" />
      </div>
      <div className="col-span-1">
        <label className="block text-xs text-blue-700 font-medium mb-1">Marca</label>
        <input className={inputCls} value={f.marca} onChange={(e) => setF('marca', e.target.value)} placeholder="Marca" />
      </div>
      {(tipo === 'tablero' || tipo === 'canto') && (
        <div className="col-span-1">
          <label className="block text-xs text-blue-700 font-medium mb-1">Ancho (mm)</label>
          <input type="number" className={inputCls} value={f.anchoMm} onChange={(e) => setF('anchoMm', e.target.value)} placeholder={tipo === 'tablero' ? '2440' : '22'} min="0" step="0.1" />
        </div>
      )}
      {tipo === 'tablero' && (
        <div className="col-span-1">
          <label className="block text-xs text-blue-700 font-medium mb-1">Largo (mm)</label>
          <input type="number" className={inputCls} value={f.largoMm} onChange={(e) => setF('largoMm', e.target.value)} placeholder="1830" min="0" step="0.1" />
        </div>
      )}
      {(tipo === 'tablero' || tipo === 'canto') && (
        <div className="col-span-1">
          <label className="block text-xs text-blue-700 font-medium mb-1">Esp. (mm)</label>
          <input type="number" className={inputCls} value={f.espesorMm} onChange={(e) => setF('espesorMm', e.target.value)} placeholder={tipo === 'tablero' ? '18' : '0.4'} min="0" step="0.01" />
        </div>
      )}
      <div className="col-span-1">
        <label className="block text-xs text-blue-700 font-medium mb-1">Precio</label>
        <input type="number" className={inputCls} value={f.precio} onChange={(e) => setF('precio', e.target.value)} placeholder="0" min="0" step="0.01" />
      </div>
      <div className="col-span-1">
        <label className="block text-xs text-blue-700 font-medium mb-1">Unidad</label>
        <input className={inputCls} value={f.unidad} onChange={(e) => setF('unidad', e.target.value)} placeholder="ud" />
      </div>
      <div className={`col-span-${tipo === 'herraje' ? 3 : 1}`}>
        <label className="block text-xs text-blue-700 font-medium mb-1">Proveedor</label>
        <input className={inputCls} value={f.proveedor} onChange={(e) => setF('proveedor', e.target.value)} placeholder="Proveedor" />
      </div>
      <div className="col-span-1 flex items-end gap-1 pb-0.5">
        {isNew ? (
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white rounded-md px-2 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> {saving ? '...' : 'Añadir'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white rounded-md px-2 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> {saving ? '...' : 'OK'}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center bg-slate-100 text-slate-500 rounded-md px-2 py-1.5 text-xs hover:bg-slate-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function EditRow({
  f, tipo, setF, onCancel, onSave, saving,
}: {
  f: FormState
  tipo: Tipo
  setF: (k: keyof FormState, v: string) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <>
      <td className="px-4 py-2">
        <input className={inputCls} value={f.nombre} onChange={(e) => setF('nombre', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} value={f.codigo} onChange={(e) => setF('codigo', e.target.value)} placeholder="—" />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} value={f.marca} onChange={(e) => setF('marca', e.target.value)} placeholder="—" />
      </td>
      {tipo === 'tablero' && (
        <>
          <td className="px-3 py-2">
            <input type="number" className={inputCls} value={f.anchoMm} onChange={(e) => setF('anchoMm', e.target.value)} min="0" step="0.1" />
          </td>
          <td className="px-3 py-2">
            <input type="number" className={inputCls} value={f.largoMm} onChange={(e) => setF('largoMm', e.target.value)} min="0" step="0.1" />
          </td>
          <td className="px-3 py-2">
            <input type="number" className={inputCls} value={f.espesorMm} onChange={(e) => setF('espesorMm', e.target.value)} min="0" step="0.01" />
          </td>
        </>
      )}
      {tipo === 'canto' && (
        <>
          <td className="px-3 py-2">
            <input type="number" className={inputCls} value={f.anchoMm} onChange={(e) => setF('anchoMm', e.target.value)} min="0" step="0.1" />
          </td>
          <td className="px-3 py-2">
            <input type="number" className={inputCls} value={f.espesorMm} onChange={(e) => setF('espesorMm', e.target.value)} min="0" step="0.01" />
          </td>
        </>
      )}
      <td className="px-3 py-2">
        <input type="number" className={inputCls} value={f.precio} onChange={(e) => setF('precio', e.target.value)} min="0" step="0.01" />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} value={f.unidad} onChange={(e) => setF('unidad', e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={inputCls} value={f.proveedor} onChange={(e) => setF('proveedor', e.target.value)} placeholder="—" />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={onSave}
            disabled={saving}
            className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            title="Guardar"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
            title="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </>
  )
}
