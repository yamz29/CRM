'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserCheck, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

interface Vendedor {
  id: number
  nombre: string
  cargo: string | null
  telefono: string | null
  correo: string | null
  activo: boolean
}

interface VendedoresPanelProps {
  initialData: Vendedor[]
}

const emptyForm = { nombre: '', cargo: '', telefono: '', correo: '', activo: true }

export function VendedoresPanel({ initialData }: VendedoresPanelProps) {
  const [vendedores, setVendedores] = useState<Vendedor[]>(initialData)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  async function refreshData() {
    const res = await fetch('/api/configuracion/vendedores')
    const data = await res.json()
    setVendedores(data)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/configuracion/vendedores', {
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
      await fetch(`/api/configuracion/vendedores/${editId}`, {
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
    if (!window.confirm('¿Eliminar este vendedor?')) return
    await fetch(`/api/configuracion/vendedores/${id}`, { method: 'DELETE' })
    await refreshData()
  }

  function startEdit(v: Vendedor) {
    setEditId(v.id)
    setEditForm({
      nombre: v.nombre,
      cargo: v.cargo || '',
      telefono: v.telefono || '',
      correo: v.correo || '',
      activo: v.activo,
    })
    setShowAddForm(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Vendedores
          </CardTitle>
          <Button
            onClick={() => {
              setShowAddForm(!showAddForm)
              setEditId(null)
            }}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Agregar vendedor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Cargo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Teléfono</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Correo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendedores.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay vendedores registrados
                  </td>
                </tr>
              )}
              {vendedores.map((v) =>
                editId === v.id ? (
                  <tr key={v.id} className="bg-blue-50">
                    <td colSpan={6} className="px-4 py-3">
                      <form onSubmit={handleEdit} className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                          <Label className="text-xs">Cargo</Label>
                          <Input
                            value={editForm.cargo}
                            onChange={(e) => setEditForm((p) => ({ ...p, cargo: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Teléfono</Label>
                          <Input
                            value={editForm.telefono}
                            onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Correo</Label>
                          <Input
                            value={editForm.correo}
                            onChange={(e) => setEditForm((p) => ({ ...p, correo: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-4">
                          <input
                            type="checkbox"
                            id={`activo-edit-${v.id}`}
                            checked={editForm.activo}
                            onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))}
                            className="w-4 h-4"
                          />
                          <Label htmlFor={`activo-edit-${v.id}`} className="text-xs">Activo</Label>
                        </div>
                        <div className="flex items-end gap-2">
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
                  <tr key={v.id} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{v.nombre}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{v.cargo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{v.telefono || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{v.correo || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          v.activo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {v.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => startEdit(v)}
                          className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
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
            <p className="text-sm font-semibold text-foreground mb-3">Nuevo vendedor</p>
            <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={addForm.nombre}
                  onChange={(e) => setAddForm((p) => ({ ...p, nombre: e.target.value }))}
                  required
                  className="h-8 text-sm"
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo</Label>
                <Input
                  value={addForm.cargo}
                  onChange={(e) => setAddForm((p) => ({ ...p, cargo: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Vendedor"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={addForm.telefono}
                  onChange={(e) => setAddForm((p) => ({ ...p, telefono: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="+56 9..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Correo</Label>
                <Input
                  value={addForm.correo}
                  onChange={(e) => setAddForm((p) => ({ ...p, correo: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="correo@empresa.cl"
                />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="activo-add"
                  checked={addForm.activo}
                  onChange={(e) => setAddForm((p) => ({ ...p, activo: e.target.checked }))}
                  className="w-4 h-4"
                />
                <Label htmlFor="activo-add" className="text-xs">Activo</Label>
              </div>
              <div className="flex items-end gap-2">
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
