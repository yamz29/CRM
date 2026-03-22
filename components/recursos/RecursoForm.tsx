'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'

const TIPOS = [
  { value: 'materiales',   label: 'Materiales' },
  { value: 'manoObra',     label: 'Mano de Obra' },
  { value: 'equipos',      label: 'Equipos' },
  { value: 'herramientas', label: 'Herramientas' },
  { value: 'subcontratos', label: 'Subcontratos' },
  { value: 'transportes',  label: 'Transportes' },
  { value: 'herrajes',     label: 'Herrajes' },
  { value: 'consumibles',  label: 'Consumibles' },
]

const UNIDADES = ['gl', 'ud', 'PA', 'm2', 'ml', 'm3', 'm', 'kg', 'ton', 'lt', 'lts', 'saco', 'pl', 'par', 'hr', 'día', 'sem', 'mes', 'viaje', 'jg']

interface Props {
  mode: 'create' | 'edit'
  initialData?: {
    id?: number
    codigo?: string
    nombre?: string
    tipo?: string
    categoria?: string
    subcategoria?: string
    unidad?: string
    costoUnitario?: number
    proveedor?: string
    marca?: string
    activo?: boolean
    observaciones?: string
    controlarStock?: boolean
    stock?: number
    stockMinimo?: number
    ultimoCosto?: number
  }
}

export function RecursoForm({ mode, initialData }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    codigo: initialData?.codigo || '',
    nombre: initialData?.nombre || '',
    tipo: initialData?.tipo || 'materiales',
    categoria: initialData?.categoria || '',
    subcategoria: initialData?.subcategoria || '',
    unidad: initialData?.unidad || 'gl',
    costoUnitario: String(initialData?.costoUnitario || 0),
    proveedor: initialData?.proveedor || '',
    marca: initialData?.marca || '',
    activo: initialData?.activo !== false,
    observaciones: initialData?.observaciones || '',
    controlarStock: initialData?.controlarStock || false,
    stock: String(initialData?.stock ?? 0),
    stockMinimo: String(initialData?.stockMinimo ?? 0),
    ultimoCosto: String(initialData?.ultimoCosto ?? 0),
  })

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        mode === 'create' ? '/api/recursos' : `/api/recursos/${initialData?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            costoUnitario: parseFloat(form.costoUnitario) || 0,
            stock: parseFloat(form.stock) || 0,
            stockMinimo: parseFloat(form.stockMinimo) || 0,
            ultimoCosto: parseFloat(form.ultimoCosto) || 0,
          }),
        }
      )
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      router.push(mode === 'create' ? '/recursos?msg=creado' : '/recursos?msg=actualizado')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Identificación</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
            <input type="text" value={form.codigo} onChange={(e) => set('codigo', e.target.value)}
              placeholder="REC-M001"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo <span className="text-red-500">*</span></label>
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nombre <span className="text-red-500">*</span></label>
          <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
            placeholder="Cemento Portland 25kg"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
            <input type="text" value={form.categoria} onChange={(e) => set('categoria', e.target.value)}
              placeholder="Mampostería"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subcategoría</label>
            <input type="text" value={form.subcategoria} onChange={(e) => set('subcategoria', e.target.value)}
              placeholder="Áridos"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Precio y Unidad</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
            <select value={form.unidad} onChange={(e) => set('unidad', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Costo Unitario ($)</label>
            <input type="number" value={form.costoUnitario} onChange={(e) => set('costoUnitario', e.target.value)}
              min="0" step="1" placeholder="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Proveedor</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
            <input type="text" value={form.proveedor} onChange={(e) => set('proveedor', e.target.value)}
              placeholder="Nombre del proveedor"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
            <input type="text" value={form.marca} onChange={(e) => set('marca', e.target.value)}
              placeholder="Marca o fabricante"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)}
            rows={2} placeholder="Notas adicionales..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="activo" checked={form.activo} onChange={(e) => set('activo', e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
          <label htmlFor="activo" className="text-sm font-medium text-slate-700">Recurso activo</label>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Inventario</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.controlarStock}
              onChange={(e) => set('controlarStock', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
            <span className="text-sm font-medium text-slate-700">Controlar stock</span>
          </label>
        </div>
        {form.controlarStock && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock actual</label>
              <input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)}
                min="0" step="0.01" placeholder="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock mínimo</label>
              <input type="number" value={form.stockMinimo} onChange={(e) => set('stockMinimo', e.target.value)}
                min="0" step="0.01" placeholder="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Último costo unit.</label>
              <input type="number" value={form.ultimoCosto} onChange={(e) => set('ultimoCosto', e.target.value)}
                min="0" step="0.01" placeholder="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right" />
            </div>
          </div>
        )}
        {!form.controlarStock && (
          <p className="text-xs text-slate-400">Activa el control de stock para registrar entradas y salidas desde los gastos del proyecto.</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push('/recursos')} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : <><Save className="w-4 h-4" />{mode === 'create' ? 'Crear Recurso' : 'Guardar Cambios'}</>}
        </Button>
      </div>
    </form>
  )
}
