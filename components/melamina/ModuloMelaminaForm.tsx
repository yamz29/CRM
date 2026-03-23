'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { AlertCircle, X, Save } from 'lucide-react'

interface Props {
  proyectos: { id: number; nombre: string }[]
  mode?: 'create' | 'edit'
  initialData?: {
    id?: number
    proyectoId?: number | null
    codigo?: string | null
    tipoModulo?: string
    nombre?: string
    ancho?: number
    alto?: number
    profundidad?: number
    material?: string
    colorAcabado?: string | null
    herrajes?: string | null
    cantidad?: number
    costoMateriales?: number
    costoManoObra?: number
    costoInstalacion?: number
    precioVenta?: number
    estadoProduccion?: string
    observaciones?: string | null
  }
}

const TIPOS_MODULO = ['Base', 'Aéreo', 'Columna', 'Panel', 'Cajón', 'Cajón esquinero', 'Isla', 'Otro']

const ESTADOS_PRODUCCION = [
  'Diseño',
  'En corte',
  'En canteado',
  'En armado',
  'Instalado',
  'Entregado',
]

export function ModuloMelaminaForm({ proyectos, mode = 'create', initialData }: Props) {
  const router = useRouter()

  const [proyectoId, setProyectoId] = useState(String(initialData?.proyectoId || ''))
  const [codigo, setCodigo] = useState(initialData?.codigo || '')
  const [tipoModulo, setTipoModulo] = useState(initialData?.tipoModulo || 'Base')
  const [nombre, setNombre] = useState(initialData?.nombre || '')
  const [ancho, setAncho] = useState(String(initialData?.ancho || ''))
  const [alto, setAlto] = useState(String(initialData?.alto || ''))
  const [profundidad, setProfundidad] = useState(String(initialData?.profundidad || ''))
  const [material, setMaterial] = useState(initialData?.material || 'Melamina Egger 18mm')
  const [colorAcabado, setColorAcabado] = useState(initialData?.colorAcabado || '')
  const [herrajes, setHerrajes] = useState(initialData?.herrajes || '')
  const [cantidad, setCantidad] = useState(String(initialData?.cantidad || 1))
  const [costoMateriales, setCostoMateriales] = useState(String(initialData?.costoMateriales || ''))
  const [costoManoObra, setCostoManoObra] = useState(String(initialData?.costoManoObra || ''))
  const [costoInstalacion, setCostoInstalacion] = useState(String(initialData?.costoInstalacion || ''))
  const [precioVenta, setPrecioVenta] = useState(String(initialData?.precioVenta || ''))
  const [estadoProduccion, setEstadoProduccion] = useState(initialData?.estadoProduccion || 'Diseño')
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculated fields
  const costoTotal =
    (parseFloat(costoMateriales) || 0) +
    (parseFloat(costoManoObra) || 0) +
    (parseFloat(costoInstalacion) || 0)
  const pventa = parseFloat(precioVenta) || 0
  const margen = pventa > 0 ? ((pventa - costoTotal) / pventa) * 100 : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nombre.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    try {
      const payload = {
        proyectoId: proyectoId ? parseInt(proyectoId) : null,
        codigo: codigo || null,
        tipoModulo,
        nombre: nombre.trim(),
        ancho: parseFloat(ancho) || 0,
        alto: parseFloat(alto) || 0,
        profundidad: parseFloat(profundidad) || 0,
        material,
        colorAcabado: colorAcabado || null,
        herrajes: herrajes || null,
        cantidad: parseInt(cantidad) || 1,
        costoMateriales: parseFloat(costoMateriales) || 0,
        costoManoObra: parseFloat(costoManoObra) || 0,
        costoInstalacion: parseFloat(costoInstalacion) || 0,
        precioVenta: parseFloat(precioVenta) || 0,
        estadoProduccion,
        observaciones: observaciones || null,
      }

      let response: Response
      if (mode === 'create') {
        response = await fetch('/api/melamina', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch(`/api/melamina/${initialData?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar')
      }

      router.push(mode === 'create' ? '/melamina?msg=creado' : '/melamina?msg=actualizado')
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Row 1: Código, Tipo, Nombre */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="MOD-001"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
          <select
            value={tipoModulo}
            onChange={(e) => setTipoModulo(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {TIPOS_MODULO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-7">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Módulo base cajones (3 cajones suaves)"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Row 2: Dimensiones, Material, Color */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ancho (mm)</label>
          <input
            type="number"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Alto (mm)</label>
          <input
            type="number"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Profundidad (mm)</label>
          <input
            type="number"
            value={profundidad}
            onChange={(e) => setProfundidad(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
          <input
            type="text"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="Melamina Egger 18mm"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Color/Acabado</label>
          <input
            type="text"
            value={colorAcabado}
            onChange={(e) => setColorAcabado(e.target.value)}
            placeholder="Blanco Alpino"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Row 3: Herrajes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Herrajes</label>
        <input
          type="text"
          value={herrajes}
          onChange={(e) => setHerrajes(e.target.value)}
          placeholder="Ej: Bisagra Blum + correderas telescópicas"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Row 4: Costos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            min="1" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Costo Materiales</label>
          <input
            type="number"
            value={costoMateriales}
            onChange={(e) => setCostoMateriales(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Costo Mano de Obra</label>
          <input
            type="number"
            value={costoManoObra}
            onChange={(e) => setCostoManoObra(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Costo Instalación</label>
          <input
            type="number"
            value={costoInstalacion}
            onChange={(e) => setCostoInstalacion(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Precio de Venta</label>
          <input
            type="number"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            min="0" step="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Calculated Summary */}
      <div className="flex gap-6 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
        <div>
          <p className="text-xs text-slate-500">Costo total</p>
          <p className="text-sm font-bold text-slate-800">{formatCurrency(costoTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Margen</p>
          <p className={`text-sm font-bold ${margen > 0 ? 'text-green-700' : 'text-red-600'}`}>
            {margen.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Total con cantidad</p>
          <p className="text-sm font-bold text-blue-700">
            {formatCurrency(pventa * (parseInt(cantidad) || 1))}
          </p>
        </div>
      </div>

      {/* Row 5: Proyecto, Estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto</label>
          <select
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Estado de Producción</label>
          <select
            value={estadoProduccion}
            onChange={(e) => setEstadoProduccion(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ESTADOS_PRODUCCION.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 6: Observaciones */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Notas adicionales sobre este módulo..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/melamina')}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Guardando...
            </span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {mode === 'create' ? 'Crear Módulo' : 'Guardar Cambios'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
