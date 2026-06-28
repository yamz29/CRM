'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2, Check, X, Route } from 'lucide-react'

interface Opt { id: number; nombre: string }

interface Linea {
  descripcion: string
  cantidad: string
  unidad: string
  proyectoId: string
  proveedorId: string
  proveedorTexto: string
  urgencia: string
  precioEstimado: string
}

function lineaVacia(): Linea {
  return { descripcion: '', cantidad: '1', unidad: 'ud', proyectoId: '', proveedorId: '', proveedorTexto: '', urgencia: 'media', precioEstimado: '' }
}

export function RutaCompraBuilder({ proveedores, proyectos }: { proveedores: Opt[]; proyectos: Opt[] }) {
  const router = useRouter()
  const toast = useToast()
  const [titulo, setTitulo] = useState('')
  const [comprador, setComprador] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()])
  const [submitting, setSubmitting] = useState(false)

  function updateLinea(i: number, patch: Partial<Linea>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLinea() { setLineas((ls) => [...ls, lineaVacia()]) }
  function removeLinea(i: number) { setLineas((ls) => ls.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    const items = lineas
      .filter((l) => l.descripcion.trim())
      .map((l) => ({
        descripcion: l.descripcion.trim(),
        cantidad: l.cantidad,
        unidad: l.unidad,
        proyectoId: l.proyectoId || null,
        proveedorId: l.proveedorId || null,
        proveedorTexto: l.proveedorId ? '' : l.proveedorTexto.trim(),
        urgencia: l.urgencia,
        precioEstimado: l.precioEstimado || null,
      }))

    if (items.length === 0) { toast.error('Agrega al menos un material'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/compras/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, comprador, fecha, items }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error')
      const { id } = await res.json()
      router.push(`/compras/rutas/${id}`)
    } catch {
      toast.error('Error al crear la ruta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Route className="w-6 h-6 text-blue-600" /> Nueva Ruta de Compra
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-border rounded-xl bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs">Título (opcional)</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ej: Compras martes AM" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Comprador</Label>
          <Input value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="Nombre del chofer/comprador" className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Material</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-20">Cant.</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-20">Unidad</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-40">Proyecto</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-44">Suplidor</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-28">Urgencia</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground w-28">Precio est.</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineas.map((l, i) => (
              <tr key={i}>
                <td className="px-3 py-2"><Input value={l.descripcion} onChange={(e) => updateLinea(i, { descripcion: e.target.value })} placeholder="Material" className="h-8 text-sm" /></td>
                <td className="px-3 py-2"><Input type="number" step="0.01" value={l.cantidad} onChange={(e) => updateLinea(i, { cantidad: e.target.value })} className="h-8 text-sm" /></td>
                <td className="px-3 py-2"><Input value={l.unidad} onChange={(e) => updateLinea(i, { unidad: e.target.value })} className="h-8 text-sm" /></td>
                <td className="px-3 py-2">
                  <select value={l.proyectoId} onChange={(e) => updateLinea(i, { proyectoId: e.target.value })} className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card">
                    <option value="">— Ninguno —</option>
                    {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select value={l.proveedorId} onChange={(e) => updateLinea(i, { proveedorId: e.target.value })} className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card">
                    <option value="">— Texto libre —</option>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {!l.proveedorId && (
                    <Input value={l.proveedorTexto} onChange={(e) => updateLinea(i, { proveedorTexto: e.target.value })} placeholder="Suplidor..." className="h-8 text-sm mt-1" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <select value={l.urgencia} onChange={(e) => updateLinea(i, { urgencia: e.target.value })} className="w-full h-8 text-sm border border-border rounded-md px-2 bg-card">
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </td>
                <td className="px-3 py-2"><Input type="number" step="0.01" value={l.precioEstimado} onChange={(e) => updateLinea(i, { precioEstimado: e.target.value })} className="h-8 text-sm text-right" /></td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => removeLinea(i)} className="p-1 text-muted-foreground hover:text-red-600" aria-label="Eliminar línea" title="Eliminar línea"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={addLinea}><Plus className="w-4 h-4" /> Agregar línea</Button>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSave} disabled={submitting}><Check className="w-4 h-4" /> {submitting ? 'Guardando...' : 'Guardar ruta'}</Button>
        <Button variant="secondary" size="sm" onClick={() => router.push('/compras/rutas')}><X className="w-4 h-4" /> Cancelar</Button>
      </div>
    </div>
  )
}
