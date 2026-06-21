'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Actividad } from './tipos'

interface Props {
  actividad: Actividad
  actividades: Actividad[]
  capitulos: string[]
  readOnly: boolean
  guardando: boolean
  onGuardar: (id: number, data: Partial<Actividad>) => Promise<void>
  onRegistrarAvance: (id: number, pct: number, comentario: string) => Promise<void>
  onEliminar: (id: number) => void
  onCrearOtra: (capitulo: string | null) => void
  onClose: () => void
}

const TIPOS_DEP = [
  { value: 'FS', label: 'Fin → Inicio (FS)' },
  { value: 'SS', label: 'Inicio → Inicio (SS)' },
  { value: 'FF', label: 'Fin → Fin (FF)' },
  { value: 'SF', label: 'Inicio → Fin (SF)' },
]

function isoDate(v: string | Date): string {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toISOString().slice(0, 10)
}

export function ActividadPanel({
  actividad, actividades, capitulos, readOnly, guardando,
  onGuardar, onRegistrarAvance, onEliminar, onCrearOtra, onClose,
}: Props) {
  const [nombre, setNombre] = useState(actividad.nombre)
  const [descripcion, setDescripcion] = useState(actividad.descripcion ?? '')
  const [tipo, setTipo] = useState(actividad.tipo)
  const [fechaInicio, setFechaInicio] = useState(isoDate(actividad.fechaInicio))
  const [duracion, setDuracion] = useState(String(actividad.duracion))
  const [dependenciaId, setDependenciaId] = useState(actividad.dependenciaId ? String(actividad.dependenciaId) : '')
  const [tipoDependencia, setTipoDependencia] = useState(actividad.tipoDependencia)
  const [desfaseDias, setDesfaseDias] = useState(String(actividad.desfaseDias))
  const [capitulo, setCapitulo] = useState(actividad.capituloNombre ?? '')
  const [pct, setPct] = useState(actividad.pctAvance)
  const [comentario, setComentario] = useState('')

  // Re-sincronizar cuando cambia la actividad seleccionada.
  useEffect(() => {
    setNombre(actividad.nombre)
    setDescripcion(actividad.descripcion ?? '')
    setTipo(actividad.tipo)
    setFechaInicio(isoDate(actividad.fechaInicio))
    setDuracion(String(actividad.duracion))
    setDependenciaId(actividad.dependenciaId ? String(actividad.dependenciaId) : '')
    setTipoDependencia(actividad.tipoDependencia)
    setDesfaseDias(String(actividad.desfaseDias))
    setCapitulo(actividad.capituloNombre ?? '')
    setPct(actividad.pctAvance)
    setComentario('')
  }, [actividad])

  async function guardarDetalles() {
    if (readOnly) return
    const data: Partial<Actividad> = {}
    if (nombre.trim() && nombre !== actividad.nombre) data.nombre = nombre.trim()
    const descActual = actividad.descripcion ?? ''
    if (descripcion !== descActual) data.descripcion = descripcion.trim() || null
    if (tipo !== actividad.tipo) data.tipo = tipo
    if (capitulo !== (actividad.capituloNombre ?? '')) data.capituloNombre = capitulo.trim() || null

    const durNum = Math.max(tipo === 'hito' ? 0 : 1, parseInt(duracion) || 1)
    const fechaInicioCambio = fechaInicio !== isoDate(actividad.fechaInicio)
    const durCambio = durNum !== actividad.duracion

    if (fechaInicioCambio) {
      const ini = new Date(fechaInicio + 'T00:00:00Z')
      const fin = new Date(ini)
      fin.setUTCDate(fin.getUTCDate() + Math.max(0, durNum - 1))
      data.fechaInicio = ini.toISOString()
      data.fechaFin = fin.toISOString()
    } else if (durCambio) {
      data.duracion = durNum
    }

    const depNum = dependenciaId ? parseInt(dependenciaId) : null
    if (depNum !== actividad.dependenciaId) data.dependenciaId = depNum
    if (tipoDependencia !== actividad.tipoDependencia) data.tipoDependencia = tipoDependencia
    const desNum = parseInt(desfaseDias) || 0
    if (desNum !== actividad.desfaseDias) data.desfaseDias = desNum

    if (Object.keys(data).length === 0) return
    await onGuardar(actividad.id, data)
  }

  const otras = actividades.filter(a => a.id !== actividad.id)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-bold text-foreground truncate">
            {readOnly ? 'Detalle de actividad' : 'Editar detalles'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} disabled={readOnly} />
          </div>

          <div className="space-y-1">
            <Label>Descripción</Label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              disabled={readOnly}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-y disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} disabled={readOnly}
                className="w-full h-10 border border-border rounded-lg px-3 text-sm bg-background disabled:opacity-50">
                <option value="tarea">Tarea</option>
                <option value="hito">Hito</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Capítulo / fase</Label>
              <input list="capitulos-list" value={capitulo} onChange={e => setCapitulo(e.target.value)} disabled={readOnly}
                placeholder="General"
                className="w-full h-10 border border-border rounded-lg px-3 text-sm bg-background disabled:opacity-50" />
              <datalist id="capitulos-list">
                {capitulos.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha inicio</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} disabled={readOnly} />
            </div>
            <div className="space-y-1">
              <Label>Duración (días)</Label>
              <Input type="number" min={tipo === 'hito' ? 0 : 1} value={duracion}
                onChange={e => setDuracion(e.target.value)} disabled={readOnly || tipo === 'hito'} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Depende de</Label>
            <select value={dependenciaId} onChange={e => setDependenciaId(e.target.value)} disabled={readOnly}
              className="w-full h-10 border border-border rounded-lg px-3 text-sm bg-background disabled:opacity-50">
              <option value="">— Ninguna —</option>
              {otras.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>

          {dependenciaId && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de vínculo</Label>
                <select value={tipoDependencia} onChange={e => setTipoDependencia(e.target.value)} disabled={readOnly}
                  className="w-full h-10 border border-border rounded-lg px-3 text-sm bg-background disabled:opacity-50">
                  {TIPOS_DEP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Desfase (días)</Label>
                <Input type="number" value={desfaseDias} onChange={e => setDesfaseDias(e.target.value)} disabled={readOnly} />
              </div>
            </div>
          )}

          {!readOnly && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={async () => { await guardarDetalles(); onClose() }} disabled={guardando}>
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </Button>
              <Button variant="secondary"
                onClick={async () => { await guardarDetalles(); onCrearOtra(capitulo.trim() || null) }}
                disabled={guardando} title="Guarda esta actividad y abre una nueva en la misma fase">
                Guardar y crear otra
              </Button>
            </div>
          )}

          {/* Avance */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Avance
              </Label>
              <span className="text-xl font-black text-foreground tabular-nums">{Math.round(pct)}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={pct} disabled={readOnly}
              onChange={e => setPct(parseFloat(e.target.value))} className="w-full accent-blue-500" />
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-teal-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
            </div>
            {!readOnly && (
              <>
                <textarea value={comentario} onChange={e => setComentario(e.target.value)}
                  rows={2} placeholder="Comentario del avance (opcional)"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
                <Button variant="secondary" onClick={() => onRegistrarAvance(actividad.id, pct, comentario)}
                  disabled={guardando} className="w-full">
                  Registrar avance
                </Button>
              </>
            )}
            {actividad.avances && actividad.avances.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground">Historial</p>
                {actividad.avances.map(av => (
                  <div key={av.id} className="flex items-center gap-2 text-[11px] text-muted-foreground py-0.5">
                    <span className="font-bold text-foreground tabular-nums">{Math.round(av.pctAvance)}%</span>
                    <span>{new Date(av.fecha).toLocaleDateString('es-DO', { timeZone: 'UTC' })}</span>
                    {av.comentario && <span className="truncate">— {av.comentario}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="px-4 py-3 border-t border-border shrink-0">
            <Button variant="danger" onClick={() => onEliminar(actividad.id)} disabled={guardando} className="w-full">
              <Trash2 className="w-4 h-4" /> Eliminar actividad
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
