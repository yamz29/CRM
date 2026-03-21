'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, X, Loader2 } from 'lucide-react'

interface ClienteFormData {
  nombre: string
  telefono: string
  whatsapp: string
  correo: string
  direccion: string
  tipoCliente: string
  fuente: string
  notas: string
}

interface ClienteFormProps {
  initialData?: Partial<ClienteFormData> & { id?: number }
  mode?: 'create' | 'edit'
}

export function ClienteForm({ initialData, mode = 'create' }: ClienteFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<ClienteFormData>({
    nombre: initialData?.nombre || '',
    telefono: initialData?.telefono || '',
    whatsapp: initialData?.whatsapp || '',
    correo: initialData?.correo || '',
    direccion: initialData?.direccion || '',
    tipoCliente: initialData?.tipoCliente || 'Particular',
    fuente: initialData?.fuente || 'Directo',
    notas: initialData?.notas || '',
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
      setError('El nombre del cliente es requerido')
      return
    }

    setLoading(true)

    try {
      const url =
        mode === 'edit' && initialData?.id
          ? `/api/clientes/${initialData.id}`
          : '/api/clientes'

      const method = mode === 'edit' ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar cliente')
      }

      if (mode === 'edit') {
        router.push('/clientes?msg=actualizado')
      } else {
        router.push('/clientes?msg=creado')
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
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nombre">Nombre completo *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Juan Pérez González"
                  required
                />
              </div>

              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="+56 9 1234 5678"
                />
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  placeholder="+56 9 1234 5678"
                />
              </div>

              <div>
                <Label htmlFor="correo">Correo electrónico</Label>
                <Input
                  id="correo"
                  name="correo"
                  type="email"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div>
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  placeholder="Calle y número, comuna"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clasificación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tipoCliente">Tipo de cliente</Label>
                <Select
                  id="tipoCliente"
                  name="tipoCliente"
                  value={formData.tipoCliente}
                  onChange={handleChange}
                >
                  <option value="Particular">Particular</option>
                  <option value="Empresa">Empresa</option>
                  <option value="Arquitecto">Arquitecto</option>
                  <option value="Inmobiliaria">Inmobiliaria</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="fuente">¿Cómo nos conoció?</Label>
                <Select
                  id="fuente"
                  name="fuente"
                  value={formData.fuente}
                  onChange={handleChange}
                >
                  <option value="Referido">Referido</option>
                  <option value="Web">Página web</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Directo">Contacto directo</option>
                  <option value="Otro">Otro</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="notas">Observaciones y notas internas</Label>
              <textarea
                id="notas"
                name="notas"
                value={formData.notas}
                onChange={handleChange}
                rows={4}
                placeholder="Notas sobre el cliente, preferencias, historial de conversaciones..."
                className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-none"
              />
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
            {mode === 'edit' ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </div>
    </form>
  )
}
