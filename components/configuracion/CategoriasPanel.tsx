'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tag, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

interface Categoria {
  id: number
  nombre: string
  tipo: string
  color: string
  descripcion: string | null
  activo: boolean
}

interface CategoriasPanelProps {
  initialData: Categoria[]
}

const emptyForm = { nombre: '', tipo: 'Proyecto', color: '#3b82f6', descripcion: '' }

const TIPOS = ['Proyecto', 'Cliente', 'Presupuesto']

export function CategoriasPanel({ initialData }: CategoriasPanelProps) {
  const [categorias, setCategorias] = useState<Categoria[]>(initialData)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  async function refreshData() {
    const res = await fetch('/api/configuracion/categorias')
    const data = await res.json()
    setCategorias(data)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/configuracion/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      await refreshData()
      setAddForm(emptyForm)
      setShowAddForm(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setLoading(true)
    try {
      await fetch(`/api/configuracion/categorias/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      await refreshData()
      setEditId(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar esta categoría?')) return
    await fetch(`/api/configuracion/categorias/${id}`, { method: 'DELETE' })
    await refreshData()
  }

  function startEdit(c: Categoria) {
    setEditId(c.id)
    setEditForm({
      nombre: c.nombre,
      tipo: c.tipo,
      color: c.color,
      descripcion: c.descripcion || '',
    })
    setShowAddForm(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Tag className="w-5 h-5 text-blue-600" />
            Categorías
          </CardTitle>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setEditId(null)
            }}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Agregar categoría
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Color</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categorias.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay categorías registradas
                  </td>
                </tr>
              )}
              {categorias.map((c) =>
                editId === c.id ? (
                  <tr key={c.id} className="bg-blue-50">
                    <td colSpan={5} className="px-4 py-3">
                      <form onSubmit={handleEdit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nombre *</Label>
                          <Input
                            value={editForm.nombre}
                            onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
                            required
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo</Label>
                          <select
                            value={editForm.tipo}
                            onChange={(e) => setEditForm((p) => ({ ...p, tipo: e.target.value }))}
                            className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card"
                          >
                            {TIPOS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Descripción</Label>
                          <Input
                            value={editForm.descripcion}
                            onChange={(e) => setEditForm((p) => ({ ...p, descripcion: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editForm.color}
                              onChange={(e) => setEditForm((p) => ({ ...p, color: e.target.value }))}
                              className="w-8 h-8 rounded cursor-pointer border border-border"
                            />
                            <span className="text-xs text-muted-foreground">{editForm.color}</span>
                          </div>
                        </div>
                        <div className="flex items-end gap-2 col-span-2 md:col-span-4">
                          <Button type="submit" size="sm" disabled={loading}>
                            <Check className="w-3 h-3" />
                            Guardar
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setEditId(null)}>
                            <X className="w-3 h-3" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{c.nombre}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-xs text-muted-foreground">{c.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.descripcion || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(c)}
                          className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {showAddForm && (
          <div className="border-t border-border bg-muted/40 px-4 py-4">
            <p className="text-sm font-semibold text-foreground mb-3">Nueva categoría</p>
            <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={addForm.nombre}
                  onChange={(e) => setAddForm((p) => ({ ...p, nombre: e.target.value }))}
                  required
                  className="h-8 text-sm"
                  placeholder="Remodelación"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <select
                  value={addForm.tipo}
                  onChange={(e) => setAddForm((p) => ({ ...p, tipo: e.target.value }))}
                  className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={addForm.descripcion}
                  onChange={(e) => setAddForm((p) => ({ ...p, descripcion: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Descripción opcional"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={addForm.color}
                    onChange={(e) => setAddForm((p) => ({ ...p, color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-border"
                  />
                  <span className="text-xs text-muted-foreground">{addForm.color}</span>
                </div>
              </div>
              <div className="flex items-end gap-2 col-span-2 md:col-span-4">
                <Button type="submit" size="sm" disabled={loading}>
                  <Check className="w-3 h-3" />
                  Agregar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false)
                    setAddForm(emptyForm)
                  }}
                >
                  <X className="w-3 h-3" />
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
