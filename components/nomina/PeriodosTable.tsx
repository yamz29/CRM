'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

interface Periodo {
  id: number
  fechaInicio: string
  fechaFin: string
  fechaPago: string | null
  estado: string
  cantidadEmpleados: number
  totalNeto: number
}

function DeletePeriodoButton({ id }: { id: number }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    const res = await fetch(`/api/nomina/periodos/${id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={handleDelete} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Sí</button>
        <button onClick={() => setConfirming(false)} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200">No</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
      title="Eliminar período">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}

export function PeriodosTable({ periodos }: { periodos: Periodo[] }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Período</th>
              <th className="text-center font-medium px-4 py-2.5">Empleados</th>
              <th className="text-right font-medium px-4 py-2.5">Total neto</th>
              <th className="text-center font-medium px-4 py-2.5">Estado</th>
              <th className="text-left font-medium px-4 py-2.5">Fecha de pago</th>
              <th className="text-right font-medium px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {periodos.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <Link href={`/nomina/${p.id}`} className="font-medium text-foreground hover:text-blue-600">
                    {formatDate(p.fechaInicio)} — {formatDate(p.fechaFin)}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-center text-foreground">{p.cantidadEmpleados}</td>
                <td className="px-4 py-2.5 text-right text-foreground tabular-nums font-medium">{formatCurrency(p.totalNeto)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.estado === 'Pagada' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {p.estado}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-foreground">{p.fechaPago ? formatDate(p.fechaPago) : '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {p.estado === 'Borrador' && <DeletePeriodoButton id={p.id} />}
                  </div>
                </td>
              </tr>
            ))}
            {periodos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay períodos de nómina registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
