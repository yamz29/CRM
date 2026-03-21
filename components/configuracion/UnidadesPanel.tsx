'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Ruler, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react'

interface UnidadGlobal {
  id: number
  codigo: string
  nombre: string
  simbolo: string | null
  tipo: string
  activo: boolean
}

const TIPOS = [
  { value: 'longitud', label: 'Longitud' },
  { value: 'area', label: 'Área' },
  { value: 'volumen', label: 'Volumen' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'tiempo', label: 'Tiempo' },
  { value: 'peso', label: 'Peso' },
  { value: 'otro', label: 'Otro' },
]

const emptyForm = { codigo: '', nombre: '', simbolo: '', tipo: 'otro', activo: true }

export function UnidadesPanel({ initialData }: { initialData: UnidadGlobal[] }) {
  const [unidades, setUnidades] = useState<UnidadGlobal[]>(initialData)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!addForm.codigo.trim() || !addForm.nombre.trim()) { setError('Código y nombre son obligatorios'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/unidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const created = await res.json()
      setUnidades((prev) => [...prev, created].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo)))
      setAddForm(emptyForm)
      setShowAddForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (u: UnidadGlobal) => {
    setEditId(u.id)
    setEditForm({ codigo: u.codigo, nombre: u.nombre, simbolo: u.simbolo || '', tipo: u.tipo, activo: u.activo })
  }

  const handleUpdate = async () => {
    if (!editId) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/unidades/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const updated = await res.json()
      setUnidades((prev) => prev.map((u) => (u.id === editId ? updated : u)))
      setEditId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (u: UnidadGlobal) => {
    try {
      const res = await fetch(`/api/unidades/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...u, activo: !u.activo }),
      })
      if (!res.ok) return
      const updated = await res.json()
      setUnidades((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
    } catch {/* ignore */}
  }

  const handleDelete = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar la unidad "${nombre}"?`)) return
    try {
      const res = await fetch(`/api/unidades/${id}`, { method: 'DELETE' })
      if (res.ok) setUnidades((prev) => prev.filter((u) => u.id !== id))
    } catch {/* ignore */}
  }

  const grouped = unidades.reduce<Record<string, UnidadGlobal[]>>((acc, u) => {
    if (!acc[u.tipo]) acc[u.tipo] = []
    acc[u.tipo].push(u)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="w-4 h-4 text-slate-500" />
              Unidades de Medida
            </CardTitle>
            <Button size="sm" onClick={() => { setShowAddForm(true); setError(null) }}>
              <Plus className="w-4 h-4" /> Nueva Unidad
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

          {/* Add form */}
          {showAddForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Nueva Unidad</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código <span className="text-red-500">*</span></Label>
                  <Input value={addForm.codigo} onChange={(e) => setAddForm((f) => ({ ...f, codigo: e.target.value }))}
                    placeholder="m2" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Símbolo</Label>
                  <Input value={addForm.simbolo} onChange={(e) => setAddForm((f) => ({ ...f, simbolo: e.target.value }))}
                    placeholder="m²" className="h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Nombre <span className="text-red-500">*</span></Label>
                  <Input value={addForm.nombre} onChange={(e) => setAddForm((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Metro cuadrado" className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <select value={addForm.tipo} onChange={(e) => setAddForm((f) => ({ ...f, tipo: e.target.value }))}
                    className="w-full border border-slate-300 rounded-md px-3 h-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">
                  <X className="w-4 h-4" />
                </button>
                <Button size="sm" onClick={handleCreate} disabled={saving}>
                  <Check className="w-4 h-4" /> {saving ? 'Guardando...' : 'Crear'}
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {unidades.length === 0 && !showAddForm && (
            <div className="text-center py-12 text-slate-400">
              <Ruler className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay unidades configuradas</p>
            </div>
          )}

          {/* Grouped tables */}
          {Object.entries(grouped).map(([tipo, items]) => (
            <div key={tipo}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                {TIPOS.find((t) => t.value === tipo)?.label || tipo}
              </p>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr className="text-xs text-slate-500 font-semibold uppercase">
                    <th className="px-3 py-2 text-left w-20">Código</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-center w-16">Símbolo</th>
                    <th className="px-3 py-2 text-center w-20">Estado</th>
                    <th className="px-3 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      {editId === u.id ? (
                        <>
                          <td className="px-2 py-1.5">
                            <Input value={editForm.codigo} onChange={(e) => setEditForm((f) => ({ ...f, codigo: e.target.value }))}
                              className="h-7 text-xs" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input value={editForm.nombre} onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                              className="h-7 text-xs" />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input value={editForm.simbolo} onChange={(e) => setEditForm((f) => ({ ...f, simbolo: e.target.value }))}
                              className="h-7 text-xs text-center" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <select value={editForm.tipo} onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value }))}
                              className="w-full border border-slate-300 rounded px-1 h-7 text-xs bg-white">
                              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex gap-1 justify-end">
                              <button onClick={handleUpdate} disabled={saving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setEditId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{u.codigo}</td>
                          <td className="px-3 py-2 text-slate-800">{u.nombre}</td>
                          <td className="px-3 py-2 text-center text-slate-500">{u.simbolo || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleToggle(u)}
                              className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${u.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                              {u.activo ? 'Activa' : 'Inactiva'}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => startEdit(u)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(u.id, u.nombre)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
