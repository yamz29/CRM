'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, X, Loader2, Send, Sun, Cloud, CloudRain, CloudLightning, Users } from 'lucide-react'

interface BitacoraFormProps {
  proyectoId: number
  avanceFisicoActual: number
  onCreated: () => void
  onCancel: () => void
}

const TIPOS = ['Avance', 'Problema', 'Inspección', 'General'] as const
const CLIMAS = [
  { value: 'Soleado', icon: Sun, color: 'text-amber-500' },
  { value: 'Nublado', icon: Cloud, color: 'text-slate-400' },
  { value: 'Lluvia', icon: CloudRain, color: 'text-blue-500' },
  { value: 'Tormenta', icon: CloudLightning, color: 'text-purple-500' },
]

const TIPO_COLORS: Record<string, string> = {
  Avance: 'bg-green-100 text-green-700 border-green-200',
  Problema: 'bg-red-100 text-red-700 border-red-200',
  'Inspección': 'bg-blue-100 text-blue-700 border-blue-200',
  General: 'bg-slate-100 text-slate-700 border-slate-200',
}

export function BitacoraForm({ proyectoId, avanceFisicoActual, onCreated, onCancel }: BitacoraFormProps) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipo, setTipo] = useState<string>('Avance')
  const [descripcion, setDescripcion] = useState('')
  const [clima, setClima] = useState<string | null>(null)
  const [personalEnObra, setPersonalEnObra] = useState('')
  const [avancePct, setAvancePct] = useState<number | null>(null)
  const [fotos, setFotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (fotos.length + files.length > 5) {
      setError('Máximo 5 fotos por entrada')
      return
    }
    setError(null)
    const newFotos = [...fotos, ...files]
    setFotos(newFotos)
    const newPreviews = files.map(f => URL.createObjectURL(f))
    setPreviews(prev => [...prev, ...newPreviews])
  }

  const removeFoto = (idx: number) => {
    URL.revokeObjectURL(previews[idx])
    setFotos(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descripcion.trim()) { setError('Escribe una descripción'); return }
    setError(null)
    setLoading(true)

    try {
      const fd = new FormData()
      fd.append('fecha', fecha)
      fd.append('tipo', tipo)
      fd.append('descripcion', descripcion)
      if (clima) fd.append('clima', clima)
      if (personalEnObra) fd.append('personalEnObra', personalEnObra)
      if (avancePct !== null) fd.append('avancePct', String(avancePct))
      fotos.forEach((f, i) => fd.append(`foto_${i}`, f))

      const res = await fetch(`/api/proyectos/${proyectoId}/bitacora`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      previews.forEach(url => URL.revokeObjectURL(url))
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-700">Nueva entrada de bitácora</h3>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">{error}</div>
        )}

        {/* Fecha + Tipo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    tipo === t ? TIPO_COLORS[t] : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Descripción *</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
            rows={3} placeholder="¿Qué se hizo hoy? ¿Qué avances hubo?"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Clima + Personal */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Clima</label>
            <div className="flex gap-1.5">
              {CLIMAS.map(c => (
                <button key={c.value} type="button" onClick={() => setClima(clima === c.value ? null : c.value)}
                  title={c.value}
                  className={`p-2 rounded-lg border transition-colors ${
                    clima === c.value ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Personal en obra</label>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <input type="number" min="0" value={personalEnObra} onChange={e => setPersonalEnObra(e.target.value)}
                placeholder="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Avance físico */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">
            Actualizar avance físico {avancePct !== null ? `→ ${avancePct}%` : `(actual: ${avanceFisicoActual}%)`}
          </label>
          <div className="flex items-center gap-3">
            <input type="range" min="0" max="100" step="5"
              value={avancePct ?? avanceFisicoActual}
              onChange={e => setAvancePct(parseInt(e.target.value))}
              className="flex-1 accent-blue-600" />
            <span className="text-sm font-bold text-slate-700 tabular-nums w-10 text-right">
              {avancePct ?? avanceFisicoActual}%
            </span>
          </div>
          {avancePct !== null && avancePct !== avanceFisicoActual && (
            <p className="text-xs text-blue-600 mt-1">
              Se actualizará el avance del proyecto de {avanceFisicoActual}% a {avancePct}%
            </p>
          )}
        </div>

        {/* Fotos */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">
            Fotos ({fotos.length}/5)
          </label>
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeFoto(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {fotos.length < 5 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                <Camera className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Agregar</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={handleFileChange} />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !descripcion.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Guardar entrada
        </Button>
      </div>
    </form>
  )
}
