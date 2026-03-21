'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Plus, Pencil, Trash2, X, Check, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react'

interface Usuario {
  id: number
  nombre: string
  correo: string
  rol: string
  activo: boolean
  hasPassword: boolean
}

const emptyForm = { nombre: '', correo: '', rol: 'Admin', activo: true, password: '', confirmPassword: '' }

const ROLES = ['Admin', 'Gerente', 'Vendedor', 'Técnico']

const ROL_COLORS: Record<string, string> = {
  Admin: 'bg-red-100 text-red-700',
  Gerente: 'bg-purple-100 text-purple-700',
  Vendedor: 'bg-blue-100 text-blue-700',
  Técnico: 'bg-amber-100 text-amber-700',
}

export function UsuariosPanel({ initialData }: { initialData: Usuario[] }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialData)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm, changePassword: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshData() {
    const res = await fetch('/api/configuracion/usuarios')
    setUsuarios(await res.json())
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (addForm.password && addForm.password !== addForm.confirmPassword) {
      setError('Las contraseñas no coinciden'); return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/configuracion/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: addForm.nombre, correo: addForm.correo,
          rol: addForm.rol, activo: addForm.activo,
          password: addForm.password || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al crear'); return }
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
    setError(null)
    if (editForm.changePassword && editForm.password !== editForm.confirmPassword) {
      setError('Las contraseñas no coinciden'); return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/configuracion/usuarios/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editForm.nombre, correo: editForm.correo,
          rol: editForm.rol, activo: editForm.activo,
          password: editForm.changePassword && editForm.password ? editForm.password : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al actualizar'); return }
      await refreshData()
      setEditId(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return
    await fetch(`/api/configuracion/usuarios/${id}`, { method: 'DELETE' })
    await refreshData()
  }

  function startEdit(u: Usuario) {
    setEditId(u.id)
    setEditForm({ nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo, password: '', confirmPassword: '', changePassword: false })
    setShowAddForm(false)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Users className="w-5 h-5 text-blue-600" />
            Usuarios con acceso al sistema
          </CardTitle>
          <Button onClick={() => { setShowAddForm(!showAddForm); setEditId(null); setError(null) }} size="sm">
            <Plus className="w-4 h-4" /> Nuevo usuario
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Los usuarios con contraseña pueden iniciar sesión. Los que no tienen contraseña son solo registros internos.
        </p>
      </CardHeader>
      <CardContent className="p-0">

        {error && (
          <div className="mx-4 mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Correo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Rol</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase">Login</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 && !showAddForm && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                    No hay usuarios. Crea el primer administrador.
                  </td>
                </tr>
              )}
              {usuarios.map((u) =>
                editId === u.id ? (
                  <tr key={u.id} className="bg-blue-50">
                    <td colSpan={6} className="px-4 py-4">
                      <form onSubmit={handleEdit} className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nombre *</Label>
                            <Input value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} required className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Correo *</Label>
                            <Input type="email" value={editForm.correo} onChange={(e) => setEditForm((p) => ({ ...p, correo: e.target.value }))} required className="h-8 text-sm" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rol</Label>
                            <select value={editForm.rol} onChange={(e) => setEditForm((p) => ({ ...p, rol: e.target.value }))}
                              className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white">
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-2 pt-4">
                            <input type="checkbox" id={`a-e-${u.id}`} checked={editForm.activo}
                              onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))} className="w-4 h-4" />
                            <Label htmlFor={`a-e-${u.id}`} className="text-xs">Activo</Label>
                          </div>
                        </div>
                        {/* Password change toggle */}
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer w-fit">
                            <input type="checkbox" checked={editForm.changePassword}
                              onChange={(e) => setEditForm((p) => ({ ...p, changePassword: e.target.checked, password: '', confirmPassword: '' }))}
                              className="w-4 h-4" />
                            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                              <KeyRound className="w-3 h-3" /> Cambiar contraseña
                            </span>
                          </label>
                          {editForm.changePassword && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Nueva contraseña (mín. 6 caracteres)</Label>
                                <Input type="password" value={editForm.password}
                                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                                  className="h-8 text-sm" placeholder="••••••" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Confirmar contraseña</Label>
                                <Input type="password" value={editForm.confirmPassword}
                                  onChange={(e) => setEditForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                                  className="h-8 text-sm" placeholder="••••••" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={loading}><Check className="w-3 h-3" /> Guardar</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => { setEditId(null); setError(null) }}><X className="w-3 h-3" /> Cancelar</Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{u.nombre}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.correo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_COLORS[u.rol] || 'bg-slate-100 text-slate-600'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.hasPassword
                        ? <span title="Puede iniciar sesión"><ShieldCheck className="w-4 h-4 text-green-500 mx-auto" /></span>
                        : <span title="Sin contraseña configurada"><ShieldOff className="w-4 h-4 text-slate-300 mx-auto" /></span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(u)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Eliminar">
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

        {/* Add form */}
        {showAddForm && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-5 space-y-4">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Nuevo usuario
            </p>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={addForm.nombre} onChange={(e) => setAddForm((p) => ({ ...p, nombre: e.target.value }))} required className="h-8 text-sm" placeholder="Juan Pérez" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Correo *</Label>
                  <Input type="email" value={addForm.correo} onChange={(e) => setAddForm((p) => ({ ...p, correo: e.target.value }))} required className="h-8 text-sm" placeholder="juan@gonzalvagroup.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rol</Label>
                  <select value={addForm.rol} onChange={(e) => setAddForm((p) => ({ ...p, rol: e.target.value }))}
                    className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white">
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="activo-add-u" checked={addForm.activo} onChange={(e) => setAddForm((p) => ({ ...p, activo: e.target.checked }))} className="w-4 h-4" />
                  <Label htmlFor="activo-add-u" className="text-xs">Activo</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><KeyRound className="w-3 h-3" /> Contraseña (mín. 6 caracteres)</Label>
                  <Input type="password" value={addForm.password} onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))} className="h-8 text-sm" placeholder="••••••" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Confirmar contraseña</Label>
                  <Input type="password" value={addForm.confirmPassword} onChange={(e) => setAddForm((p) => ({ ...p, confirmPassword: e.target.value }))} className="h-8 text-sm" placeholder="••••••" />
                </div>
              </div>
              <p className="text-xs text-slate-400">Si no ingresa contraseña, el usuario no podrá iniciar sesión.</p>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading}><Check className="w-3 h-3" /> Crear usuario</Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => { setShowAddForm(false); setAddForm(emptyForm); setError(null) }}><X className="w-3 h-3" /> Cancelar</Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
