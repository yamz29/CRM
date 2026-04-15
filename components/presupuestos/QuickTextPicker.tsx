'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Pencil, Trash2, Search, FileText, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ────────────────────────────────────────────────────────────────

interface QuickText {
  id: number
  nombre: string
  categoria: string | null
  contenido: string
  orden: number
}

interface Props {
  onInsert: (texto: string) => void
  onClose: () => void
  /** Current value of the textarea for "save current as template" */
  currentText?: string
}

// ── Component ────────────────────────────────────────────────────────────

export function QuickTextPicker({ onInsert, onClose, currentText }: Props) {
  const [items, setItems] = useState<QuickText[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', categoria: '', contenido: '' })
  const [saving, setSaving] = useState(false)

  // ── Load ─────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const res = await fetch('/api/quicktexts')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Filter + group by categoria ───────────────────────────────────
  const grouped = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = q
      ? items.filter(i =>
          i.nombre.toLowerCase().includes(q) ||
          i.contenido.toLowerCase().includes(q) ||
          (i.categoria?.toLowerCase().includes(q) ?? false)
        )
      : items
    const map = new Map<string, QuickText[]>()
    for (const item of filtered) {
      const cat = item.categoria || 'General'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return map
  }, [items, search])

  // ── Form actions ──────────────────────────────────────────────────
  function openNew(presetContent?: string) {
    setEditingId(null)
    setForm({ nombre: '', categoria: '', contenido: presetContent || '' })
    setShowForm(true)
  }

  function openEdit(item: QuickText) {
    setEditingId(item.id)
    setForm({ nombre: item.nombre, categoria: item.categoria || '', contenido: item.contenido })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.contenido.trim()) return
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || null,
      contenido: form.contenido.trim(),
    }
    if (editingId) {
      await fetch(`/api/quicktexts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/quicktexts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setShowForm(false)
    setEditingId(null)
    setForm({ nombre: '', categoria: '', contenido: '' })
    setSaving(false)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await fetch(`/api/quicktexts/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Plantillas de notas y condiciones
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {showForm ? (
          /* ── Form view ── */
          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
              <input
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="ej: Forma de pago 50/50"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Categoría</label>
              <input
                value={form.categoria}
                onChange={e => setForm({ ...form, categoria: e.target.value })}
                placeholder="ej: Forma de pago, Garantía, Condiciones generales..."
                list="quicktext-categorias"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <datalist id="quicktext-categorias">
                {Array.from(new Set(items.map(i => i.categoria).filter(Boolean))).map(c => (
                  <option key={c} value={c!} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Contenido *</label>
              <textarea
                value={form.contenido}
                onChange={e => setForm({ ...form, contenido: e.target.value })}
                rows={8}
                placeholder="El texto completo que se insertará..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.nombre.trim() || !form.contenido.trim()}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </div>
        ) : (
          /* ── List view ── */
          <>
            <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar plantilla..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {currentText && currentText.trim() && (
                <Button size="sm" variant="outline" onClick={() => openNew(currentText)}>
                  <Plus className="w-3.5 h-3.5" /> Guardar nota actual
                </Button>
              )}
              <Button size="sm" onClick={() => openNew()}>
                <Plus className="w-3.5 h-3.5" /> Nueva
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : grouped.size === 0 ? (
                <div className="text-center py-10">
                  <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {items.length === 0 ? 'Aún no hay plantillas creadas' : 'No hay resultados para esta búsqueda'}
                  </p>
                  {items.length === 0 && (
                    <Button size="sm" onClick={() => openNew()} className="mt-3">
                      <Plus className="w-3.5 h-3.5" /> Crear primera plantilla
                    </Button>
                  )}
                </div>
              ) : (
                Array.from(grouped.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
                    <div className="space-y-1.5">
                      {list.map(item => (
                        <div key={item.id} className="group border border-border rounded-lg p-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{item.nombre}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => openEdit(item)}
                                className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                                title="Editar"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1 text-muted-foreground hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3 mb-2">
                            {item.contenido}
                          </p>
                          <button
                            onClick={() => { onInsert(item.contenido); onClose() }}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Check className="w-3 h-3" /> Insertar esta plantilla
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
