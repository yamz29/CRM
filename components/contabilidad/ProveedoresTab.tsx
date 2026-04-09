'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus, Pencil, Trash2, Check, X, Search, Building2, Loader2,
  Phone, Mail, User, FileText,
} from 'lucide-react'

interface Proveedor {
  id: number
  nombre: string
  rnc: string | null
  telefono: string | null
  contacto: string | null
  correo: string | null
  direccion: string | null
  condicionesPago: string | null
  notas: string | null
  activo: boolean
  _count: { facturas: number }
}

const emptyForm = {
  nombre: '', rnc: '', telefono: '', contacto: '',
  correo: '', direccion: '', condicionesPago: '', notas: '',
}

export function ProveedoresTab() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInactivos, setShowInactivos] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proveedores?activos=${!showInactivos}`)
      if (res.ok) setProveedores(await res.json())
    } finally {
      setLoading(false)
    }
  }, [showInactivos])

  useEffect(() => { fetchData() }, [fetchData])

  function startNew() {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
    setError(null)
  }

  function startEdit(p: Proveedor) {
    setForm({
      nombre: p.nombre,
      rnc: p.rnc ?? '',
      telefono: p.telefono ?? '',
      contacto: p.contacto ?? '',
      correo: p.correo ?? '',
      direccion: p.direccion ?? '',
      condicionesPago: p.condicionesPago ?? '',
      notas: p.notas ?? '',
    })
    setEditId(p.id)
    setShowForm(true)
    setError(null)
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
      const url = editId ? `/api/proveedores/${editId}` : '/api/proveedores'
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al guardar')
      }
      await fetchData()
      cancelForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Desactivar este proveedor? Las facturas asociadas no se afectan.')) return
    try {
      await fetch(`/api/proveedores/${id}`, { method: 'DELETE' })
      await fetchData()
    } catch {}
  }

  async function handleReactivar(id: number) {
    try {
      await fetch(`/api/proveedores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: true }),
      })
      await fetchData()
    } catch {}
  }

  const filtrados = proveedores.filter((p) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return p.nombre.toLowerCase().includes(q) ||
      p.rnc?.toLowerCase().includes(q) ||
      p.contacto?.toLowerCase().includes(q) ||
      p.correo?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RNC..."
            className="pl-9 h-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showInactivos} onChange={(e) => setShowInactivos(e.target.checked)} className="w-3.5 h-3.5" />
          Mostrar inactivos
        </label>
        {!showForm && (
          <Button onClick={startNew} size="sm"><Plus className="w-4 h-4" /> Nuevo proveedor</Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-border rounded-xl bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {editId ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre / Razón social *</Label>
                <Input required value={form.nombre} onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ferretería Central S.R.L." className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RNC / Cédula</Label>
                <Input value={form.rnc} onChange={(e) => setForm(p => ({ ...p, rnc: e.target.value }))} placeholder="123456789" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input value={form.telefono} onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="809-000-0000" className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Persona de contacto</Label>
                <Input value={form.contacto} onChange={(e) => setForm(p => ({ ...p, contacto: e.target.value }))} placeholder="Juan Pérez" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Correo</Label>
                <Input type="email" value={form.correo} onChange={(e) => setForm(p => ({ ...p, correo: e.target.value }))} placeholder="ventas@ejemplo.com" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Condiciones de pago</Label>
                <Input value={form.condicionesPago} onChange={(e) => setForm(p => ({ ...p, condicionesPago: e.target.value }))} placeholder="30 días" className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm(p => ({ ...p, direccion: e.target.value }))} placeholder="Calle Principal #123, Santo Domingo" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <textarea value={form.notas} onChange={(e) => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} className="w-full text-sm border border-border rounded-md px-3 py-2 bg-card resize-none" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} size="sm">
                <Check className="w-3.5 h-3.5" /> {submitting ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={cancelForm}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-12 text-center">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">Sin proveedores</p>
          <p className="text-xs text-muted-foreground mt-1">Agrega tus primeros suplidores para normalizar tus facturas</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Proveedor</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">RNC</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Contacto</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Teléfono</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Cond. pago</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Facturas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((p) => (
                <tr key={p.id} className={`hover:bg-muted/40 ${!p.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{p.nombre}</p>
                    {p.correo && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{p.correo}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.rnc || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.contacto || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.telefono || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.condicionesPago || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {p._count.facturas > 0 ? p._count.facturas : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => startEdit(p)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {p.activo ? (
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Desactivar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => handleReactivar(p.id)} className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors" title="Reactivar">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
