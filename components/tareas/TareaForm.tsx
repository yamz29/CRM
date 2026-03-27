'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle, X, Save } from 'lucide-react'

interface Props {
  clientes: { id: number; nombre: string }[]
  proyectos: { id: number; nombre: string; clienteId: number }[]
  usuarios: { id: number; nombre: string }[]
  mode?: 'create' | 'edit'
  initialData?: {
    id?: number
    titulo?: string
    descripcion?: string
    clienteId?: number | null
    proyectoId?: number | null
    asignadoId?: number | null
    fechaLimite?: Date | string | null
    prioridad?: string
    estado?: string
    avance?: number
    responsable?: string | null
  }
}

const PRIORIDADES = ['Alta', 'Media', 'Baja']
const ESTADOS = ['Pendiente', 'En proceso', 'Completada', 'Cancelada']

function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

export function TareaForm({ clientes, proyectos, usuarios, mode = 'create', initialData }: Props) {
  const router = useRouter()

  const [titulo, setTitulo] = useState(initialData?.titulo || '')
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || '')
  const [clienteId, setClienteId] = useState(String(initialData?.clienteId || ''))
  const [proyectoId, setProyectoId] = useState(String(initialData?.proyectoId || ''))
  const [fechaLimite, setFechaLimite] = useState(formatDateInput(initialData?.fechaLimite))
  const [prioridad, setPrioridad] = useState(initialData?.prioridad || 'Media')
  const [estado, setEstado] = useState(initialData?.estado || 'Pendiente')
  const [avance, setAvance] = useState(initialData?.avance ?? 0)
  const [responsable, setResponsable] = useState(initialData?.responsable || '')
  const [asignadoId, setAsignadoId] = useState(String(initialData?.asignadoId || ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredProyectos = clienteId
    ? proyectos.filter((p) => p.clienteId === parseInt(clienteId))
    : proyectos

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!titulo.trim()) {
      setError('El título es requerido')
      return
    }

    setLoading(true)
    try {
      const payload = {
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        clienteId: clienteId ? parseInt(clienteId) : null,
        proyectoId: proyectoId ? parseInt(proyectoId) : null,
        asignadoId: asignadoId ? parseInt(asignadoId) : null,
        fechaLimite: fechaLimite || null,
        prioridad,
        estado,
        avance,
        responsable: responsable || null,
      }

      let response: Response
      if (mode === 'create') {
        response = await fetch('/api/tareas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch(`/api/tareas/${initialData?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar')
      }

      router.push(mode === 'create' ? '/tareas?msg=creado' : '/tareas?msg=actualizado')
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

      {/* Título */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: Enviar presupuesto al cliente..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Detalles adicionales de la tarea..."
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Cliente / Proyecto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value)
              setProyectoId('')
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto</label>
          <select
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            disabled={!clienteId}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
          >
            <option value="">Sin proyecto</option>
            {filteredProyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha / Prioridad / Estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
          <input
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            min={mode === 'create' ? new Date().toISOString().split('T')[0] : undefined}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Avance */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Avance <span className="text-slate-400 font-normal ml-1">{avance}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={avance}
          onChange={(e) => setAvance(parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-0.5">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* Asignado a */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Asignado a</label>
        <select
          value={asignadoId}
          onChange={(e) => setAsignadoId(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Sin asignar</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/tareas')}
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
              {mode === 'create' ? 'Crear Tarea' : 'Guardar Cambios'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
