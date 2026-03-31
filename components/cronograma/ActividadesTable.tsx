'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, TrendingUp, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { Actividad } from './CronogramaClient'

const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':    'bg-slate-100 text-slate-700 border-slate-200',
  'En Ejecución': 'bg-blue-100 text-blue-700 border-blue-200',
  'Completado':   'bg-green-100 text-green-700 border-green-200',
  'Atrasado':     'bg-red-100 text-red-700 border-red-200',
}

interface Props {
  actividades: Actividad[]
  onActualizar: (id: number, data: Partial<Actividad>) => Promise<void>
  onEliminar: (id: number) => Promise<void>
  onAbrirAvance: (a: Actividad) => void
}

function toDateInput(d: string | Date) {
  return new Date(d).toISOString().split('T')[0]
}

export function ActividadesTable({ actividades, onActualizar, onEliminar, onAbrirAvance }: Props) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Actividad>>({})
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  // Agrupar por capítulo
  const grupos = new Map<string, Actividad[]>()
  for (const a of actividades) {
    const key = a.capituloNombre ?? 'General'
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(a)
  }

  function startEdit(a: Actividad) {
    setEditId(a.id)
    setEditForm({
      nombre: a.nombre,
      duracion: a.duracion,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      pctAvance: a.pctAvance,
      estado: a.estado,
    })
  }

  async function saveEdit(id: number) {
    await onActualizar(id, editForm)
    setEditId(null)
  }

  function toggleGrupo(key: string) {
    setColapsados(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-6"></th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Actividad</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase w-16">Días</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Inicio</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Fin</th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase w-20">Avance</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-28">Estado</th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase w-28">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {actividades.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                Sin actividades. Agrega una o genera desde un presupuesto.
              </td>
            </tr>
          )}

          {Array.from(grupos.entries()).map(([capitulo, acts]) => {
            const colapsado = colapsados.has(capitulo)
            const pctGrupo = Math.round(acts.reduce((s, a) => s + a.pctAvance, 0) / acts.length)

            return [
              // Fila grupo
              <tr key={`g-${capitulo}`} className="bg-muted/20 cursor-pointer" onClick={() => toggleGrupo(capitulo)}>
                <td className="px-3 py-2">
                  {colapsado
                    ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </td>
                <td className="px-3 py-2" colSpan={4}>
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">{capitulo}</span>
                  <span className="text-xs text-muted-foreground ml-2">({acts.length} actividades)</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="text-xs font-bold text-foreground">{pctGrupo}%</span>
                </td>
                <td colSpan={2} className="px-3 py-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctGrupo}%` }} />
                  </div>
                </td>
              </tr>,

              // Filas actividades del grupo
              ...(!colapsado ? acts.map(a => (
                editId === a.id ? (
                  <tr key={a.id} className="bg-blue-50/50 dark:bg-blue-900/10">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2">
                      <Input value={editForm.nombre ?? ''} onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                        className="h-7 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="1" value={editForm.duracion ?? 1}
                        onChange={e => setEditForm(p => ({ ...p, duracion: parseInt(e.target.value) }))}
                        className="h-7 text-xs w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="date" value={toDateInput(editForm.fechaInicio ?? a.fechaInicio)}
                        onChange={e => setEditForm(p => ({ ...p, fechaInicio: e.target.value }))}
                        className="h-7 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="date" value={toDateInput(editForm.fechaFin ?? a.fechaFin)}
                        onChange={e => setEditForm(p => ({ ...p, fechaFin: e.target.value }))}
                        className="h-7 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min="0" max="100" value={editForm.pctAvance ?? 0}
                        onChange={e => setEditForm(p => ({ ...p, pctAvance: parseFloat(e.target.value) }))}
                        className="h-7 text-xs w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={editForm.estado ?? 'Pendiente'}
                        onChange={e => setEditForm(p => ({ ...p, estado: e.target.value }))}
                        className="h-7 text-xs border border-border rounded px-1 bg-background">
                        {['Pendiente', 'En Ejecución', 'Completado', 'Atrasado'].map(s =>
                          <option key={s} value={s}>{s}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => saveEdit(a.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Guardar">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded" title="Cancelar">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 pl-7" />
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-foreground">{a.nombre}</p>
                      {a.dependencia && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          FS: {a.dependencia.nombre}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-muted-foreground">{a.duracion}d</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {new Date(a.fechaInicio).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {new Date(a.fechaFin).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${a.pctAvance >= 100 ? 'bg-green-500' : a.estado === 'Atrasado' ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${a.pctAvance}%` }} />
                        </div>
                        <span className="text-xs font-bold text-foreground w-8 text-right tabular-nums">{a.pctAvance.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLORS[a.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {a.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => onAbrirAvance(a)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded" title="Registrar avance">
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => startEdit(a)} className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onEliminar(a.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )) : []),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
