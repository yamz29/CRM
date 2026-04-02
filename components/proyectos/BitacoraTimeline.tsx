'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { BitacoraForm } from './BitacoraForm'
import { formatDate } from '@/lib/utils'
import {
  Plus, Trash2, Sun, Cloud, CloudRain, CloudLightning,
  Users, TrendingUp, AlertTriangle, ClipboardCheck, FileText,
  ChevronDown, ChevronUp, Image as ImageIcon, Loader2,
} from 'lucide-react'

interface Foto {
  id: number
  url: string
  caption: string | null
}

interface Entrada {
  id: number
  fecha: string
  tipo: string
  descripcion: string
  clima: string | null
  personalEnObra: number | null
  avancePct: number | null
  createdAt: string
  usuario: { id: number; nombre: string } | null
  fotos: Foto[]
}

interface BitacoraTimelineProps {
  proyectoId: number
  avanceFisicoActual: number
}

const TIPO_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
  Avance:      { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
  Problema:    { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  'Inspección': { icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
  General:     { icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' },
}

const CLIMA_ICON: Record<string, typeof Sun> = {
  Soleado: Sun, Nublado: Cloud, Lluvia: CloudRain, Tormenta: CloudLightning,
}

export function BitacoraTimeline({ proyectoId, avanceFisicoActual }: BitacoraTimelineProps) {
  const [entradas, setEntradas] = useState<Entrada[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [lightbox, setLightbox] = useState<string | null>(null)

  const fetchEntradas = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/proyectos/${proyectoId}/bitacora`)
    if (res.ok) setEntradas(await res.json())
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { fetchEntradas() }, [fetchEntradas])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta entrada?')) return
    await fetch(`/api/proyectos/${proyectoId}/bitacora/${id}`, { method: 'DELETE' })
    fetchEntradas()
  }

  const toggleExpand = (id: number) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Group entries by date
  const grouped: Record<string, Entrada[]> = {}
  for (const e of entradas) {
    const d = e.fecha.slice(0, 10)
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(e)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Bitácora de obra ({entradas.length} {entradas.length === 1 ? 'entrada' : 'entradas'})
        </h3>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Nueva entrada
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <BitacoraForm
          proyectoId={proyectoId}
          avanceFisicoActual={avanceFisicoActual}
          onCreated={() => { setShowForm(false); fetchEntradas() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && entradas.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">Sin entradas en la bitácora</p>
          <p className="text-slate-400 text-xs mt-1">Registra el avance diario del proyecto desde campo</p>
          <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Primera entrada
          </Button>
        </div>
      )}

      {/* Timeline */}
      {!loading && Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="relative">
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mb-2">
            <span className="text-xs font-bold text-slate-600">{formatDate(date)}</span>
            <span className="text-xs text-slate-400 ml-2">
              {items.length} {items.length === 1 ? 'entrada' : 'entradas'}
            </span>
          </div>

          <div className="space-y-3 pl-4 border-l-2 border-slate-200 ml-3">
            {items.map(entry => {
              const cfg = TIPO_CONFIG[entry.tipo] || TIPO_CONFIG.General
              const Icon = cfg.icon
              const isExpanded = expanded.has(entry.id)
              const ClimaIcon = entry.clima ? CLIMA_ICON[entry.clima] : null

              return (
                <div key={entry.id} className="relative bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[25px] top-4 w-3 h-3 rounded-full border-2 border-white ${cfg.bg}`} />

                  {/* Entry header */}
                  <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleExpand(entry.id)}>
                    <div className={`p-1.5 rounded-lg ${cfg.bg} flex-shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {entry.tipo}
                        </span>
                        {ClimaIcon && <ClimaIcon className="w-3.5 h-3.5 text-slate-400" />}
                        {entry.personalEnObra != null && entry.personalEnObra > 0 && (
                          <span className="text-xs text-slate-400 flex items-center gap-0.5">
                            <Users className="w-3 h-3" /> {entry.personalEnObra}
                          </span>
                        )}
                        {entry.avancePct != null && (
                          <span className="text-xs text-blue-600 font-medium">
                            Avance → {entry.avancePct}%
                          </span>
                        )}
                        {entry.fotos.length > 0 && (
                          <span className="text-xs text-slate-400 flex items-center gap-0.5">
                            <ImageIcon className="w-3 h-3" /> {entry.fotos.length}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm text-slate-700 mt-1 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                        {entry.descripcion}
                      </p>
                      {entry.usuario && (
                        <p className="text-xs text-slate-400 mt-1">— {entry.usuario.nombre}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-slate-100">
                      {/* Photos grid */}
                      {entry.fotos.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                          {entry.fotos.map(foto => (
                            <div key={foto.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setLightbox(foto.url) }}>
                              <img src={foto.url} alt={foto.caption || ''} className="w-full h-full object-cover" />
                              {foto.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                                  {foto.caption}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-slate-400">
                          {new Date(entry.createdAt).toLocaleString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                          className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors">
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
