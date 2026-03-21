'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, X, Loader2 } from 'lucide-react'

interface Cliente {
  id: number
  nombre: string
}

interface ProyectoFormData {
  nombre: string
  clienteId: string
  tipoProyecto: string
  ubicacion: string
  fechaInicio: string
  fechaEstimada: string
  estado: string
  descripcion: string
  responsable: string
  presupuestoEstimado: string
}

interface ProyectoFormProps {
  clientes: Cliente[]
  initialData?: Partial<ProyectoFormData> & { id?: number }
  mode?: 'create' | 'edit'
  defaultClienteId?: string
}

export function ProyectoForm({ clientes, initialData, mode = 'create', defaultClienteId }: ProyectoFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<ProyectoFormData>({
    nombre: initialData?.nombre || '',
    clienteId: initialData?.clienteId || defaultClienteId || '',
    tipoProyecto: initialData?.tipoProyecto || 'Remodelación',
    ubicacion: initialData?.ubicacion || '',
    fechaInicio: initialData?.fechaInicio || '',
    fechaEstimada: initialData?.fechaEstimada || '',
    estado: initialData?.estado || 'Prospecto',
    descripcion: initialData?.descripcion || '',
    responsable: initialData?.responsable || '',
    presupuestoEstimado: initialData?.presupuestoEstimado || '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.nombre.trim()) {
      setError('El nombre del proyecto es requerido')
      return
    }
    if (!formData.clienteId) {
      setError('Debe seleccionar un cliente')
      return
    }

    setLoading(true)

    try {
      const url =
        mode === 'edit' && initialData?.id
          ? `/api/proyectos/${initialData.id}`
          : '/api/proyectos'

      const method = mode === 'edit' ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          presupuestoEstimado: formData.presupuestoEstimado
            ? parseFloat(formData.presupuestoEstimado.replace(/\./g, '').replace(',', '.'))
            : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar proyecto')
      }

      if (mode === 'edit') {
        router.push('/proyectos?msg=actualizado')
      } else {
        router.push('/proyectos?msg=creado')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Información del Proyecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nombre">Nombre del proyecto *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Remodelación cocina y baños - Casa Las Condes"
                  required
                />
              </div>

              <div>
                <Label htmlFor="clienteId">Cliente *</Label>
                <Select
                  id="clienteId"
                  name="clienteId"
                  value={formData.clienteId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Selecciona un cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="tipoProyecto">Tipo de proyecto</Label>
                <Select
                  id="tipoProyecto"
                  name="tipoProyecto"
                  value={formData.tipoProyecto}
                  onChange={handleChange}
                >
                  <option value="Remodelación">Remodelación</option>
                  <option value="Construcción">Construcción</option>
                  <option value="Diseño">Diseño</option>
                  <option value="Melamina">Melamina / Ebanistería</option>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="ubicacion">Ubicación / Dirección</Label>
                <Input
                  id="ubicacion"
                  name="ubicacion"
                  value={formData.ubicacion}
                  onChange={handleChange}
                  placeholder="Dirección de la obra o proyecto"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado y Fechas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="estado">Estado del proyecto</Label>
                <Select
                  id="estado"
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                >
                  <option value="Prospecto">Prospecto</option>
                  <option value="En Cotización">En Cotización</option>
                  <option value="Adjudicado">Adjudicado</option>
                  <option value="En Ejecución">En Ejecución</option>
                  <option value="Terminado">Terminado</option>
                  <option value="Cancelado">Cancelado</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="fechaInicio">Fecha de inicio</Label>
                <Input
                  id="fechaInicio"
                  name="fechaInicio"
                  type="date"
                  value={formData.fechaInicio}
                  onChange={handleChange}
                />
              </div>

              <div>
                <Label htmlFor="fechaEstimada">Fecha estimada de término</Label>
                <Input
                  id="fechaEstimada"
                  name="fechaEstimada"
                  type="date"
                  value={formData.fechaEstimada}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalles Adicionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="responsable">Responsable / Jefe de obra</Label>
                <Input
                  id="responsable"
                  name="responsable"
                  value={formData.responsable}
                  onChange={handleChange}
                  placeholder="Nombre del responsable"
                />
              </div>

              <div>
                <Label htmlFor="presupuestoEstimado">Presupuesto estimado ($)</Label>
                <Input
                  id="presupuestoEstimado"
                  name="presupuestoEstimado"
                  type="number"
                  value={formData.presupuestoEstimado}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="descripcion">Descripción del proyecto</Label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe el alcance del proyecto, materiales, requisitos especiales..."
                  className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={loading}
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {mode === 'edit' ? 'Guardar cambios' : 'Crear proyecto'}
          </Button>
        </div>
      </div>
    </form>
  )
}
