'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle, X, Save } from 'lucide-react'

interface Props {
  tableros: { id: number; nombre: string; codigo: string | null }[]
  mode?: 'create' | 'edit'
  initialData?: {
    id?: number
    codigo?: string | null
    tipoModulo?: string
    nombre?: string
    ancho?: number
    alto?: number
    profundidad?: number
    recursoTableroId?: number | null
    colorAcabado?: string | null
    observaciones?: string | null
  }
}

const TIPOS_MODULO = [
  'Base con puertas', 'Base con cajones', 'Base mixto',
  'Aéreo con puertas', 'Columna', 'Closet', 'Baño', 'Oficina', 'Otro',
]

export function ModuloMelaminaForm({ tableros, mode = 'create', initialData }: Props) {
  const router = useRouter()

  const [codigo, setCodigo] = useState(initialData?.codigo || '')
  const [tipoModulo, setTipoModulo] = useState(initialData?.tipoModulo || 'Base con puertas')
  const [nombre, setNombre] = useState(initialData?.nombre || '')
  const [ancho, setAncho] = useState(String(initialData?.ancho || ''))
  const [alto, setAlto] = useState(String(initialData?.alto || ''))
  const [profundidad, setProfundidad] = useState(String(initialData?.profundidad || ''))
  const [recursoTableroId, setRecursoTableroId] = useState(String(initialData?.recursoTableroId || ''))
  const [colorAcabado, setColorAcabado] = useState(initialData?.colorAcabado || '')
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nombre.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    try {
      const tablero = tableros.find(t => t.id === parseInt(recursoTableroId))
      const payload = {
        codigo: codigo || null,
        tipoModulo,
        nombre: nombre.trim(),
        ancho: parseFloat(ancho) || 0,
        alto: parseFloat(alto) || 0,
        profundidad: parseFloat(profundidad) || 0,
        material: tablero?.nombre || '',
        colorAcabado: colorAcabado || null,
        observaciones: observaciones || null,
        // defaults kept for DB compatibility
        herrajes: null,
        cantidad: 1,
        costoMateriales: 0,
        costoManoObra: 0,
        costoInstalacion: 0,
        precioVenta: 0,
        estadoProduccion: 'Diseño',
        proyectoId: null,
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

      {/* Código, Tipo, Nombre */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="B90-001"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
          <select
            value={tipoModulo}
            onChange={(e) => setTipoModulo(e.target.value)}
            className={inputCls + ' bg-white'}
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
            placeholder="Ej: Base 90 con puertas"
            className={inputCls}
          />
        </div>
      </div>

      {/* Dimensiones */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ancho (mm)</label>
          <input
            type="number"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            min="0" step="1"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Alto (mm)</label>
          <input
            type="number"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            min="0" step="1"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Profundidad (mm)</label>
          <input
            type="number"
            value={profundidad}
            onChange={(e) => setProfundidad(e.target.value)}
            min="0" step="1"
            className={inputCls}
          />
        </div>
      </div>

      {/* Material y Color */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Material (tablero)</label>
          <select
            value={recursoTableroId}
            onChange={(e) => setRecursoTableroId(e.target.value)}
            className={inputCls + ' bg-white'}
          >
            <option value="">— Sin tablero —</option>
            {tableros.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo ? `[${t.codigo}] ` : ''}{t.nombre}
              </option>
            ))}
          </select>
          {tableros.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No hay tableros en el catálogo. Agrega recursos con categoría &quot;tablero&quot;.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Color / Acabado</label>
          <input
            type="text"
            value={colorAcabado}
            onChange={(e) => setColorAcabado(e.target.value)}
            placeholder="Blanco Alpino"
            className={inputCls}
          />
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Notas adicionales sobre este módulo..."
          className={inputCls + ' resize-none'}
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
