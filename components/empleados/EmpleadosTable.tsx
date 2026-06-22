'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Search, Pencil, CalendarClock } from 'lucide-react'
import { DeleteEmpleadoButton } from './DeleteEmpleadoButton'

interface Empleado {
  id: number
  nombre: string
  cedula: string | null
  telefono: string | null
  cargo: string | null
  departamento: string | null
  fechaIngreso: string
  fechaSalida: string | null
  activo: boolean
  salario?: number | null
  solicitudesPendientes: number
}

type EstadoFilter = 'todos' | 'activos' | 'inactivos'

export function EmpleadosTable({ empleados, esAdmin }: { empleados: Empleado[]; esAdmin: boolean }) {
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('activos')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return empleados.filter((e) => {
      if (estadoFilter === 'activos' && !e.activo) return false
      if (estadoFilter === 'inactivos' && e.activo) return false
      if (!q) return true
      return (
        e.nombre.toLowerCase().includes(q) ||
        (e.cedula?.toLowerCase().includes(q) ?? false) ||
        (e.cargo?.toLowerCase().includes(q) ?? false) ||
        (e.departamento?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [empleados, search, estadoFilter])

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula, cargo..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
          />
        </div>
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value as EstadoFilter)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-card"
        >
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {empleados.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Nombre</th>
              <th className="text-left font-medium px-4 py-2.5">Cargo</th>
              <th className="text-left font-medium px-4 py-2.5">Departamento</th>
              <th className="text-left font-medium px-4 py-2.5">Ingreso</th>
              {esAdmin && <th className="text-right font-medium px-4 py-2.5">Salario</th>}
              <th className="text-center font-medium px-4 py-2.5">Estado</th>
              <th className="text-center font-medium px-4 py-2.5">Solicitudes</th>
              <th className="text-right font-medium px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/empleados/${e.id}`} className="font-medium text-foreground hover:text-blue-600">
                    {e.nombre}
                  </Link>
                  {e.cedula && <p className="text-xs text-muted-foreground">{e.cedula}</p>}
                </td>
                <td className="px-4 py-2.5 text-foreground">{e.cargo || '—'}</td>
                <td className="px-4 py-2.5 text-foreground">{e.departamento || '—'}</td>
                <td className="px-4 py-2.5 text-foreground">{formatDate(e.fechaIngreso)}</td>
                {esAdmin && (
                  <td className="px-4 py-2.5 text-right text-foreground tabular-nums">
                    {e.salario ? formatCurrency(e.salario) : '—'}
                  </td>
                )}
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    e.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  {e.solicitudesPendientes > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-medium">
                      <CalendarClock className="w-3 h-3" /> {e.solicitudesPendientes}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/empleados/${e.id}/editar`}
                      className="p-1.5 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <DeleteEmpleadoButton id={e.id} nombre={e.nombre} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={esAdmin ? 8 : 7} className="text-center text-muted-foreground py-8">
                  No hay empleados que coincidan con la búsqueda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
