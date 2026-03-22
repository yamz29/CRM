'use client'

import { formatCurrency } from '@/lib/utils'
import { Package, AlertTriangle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RecursoStock {
  id: number
  codigo: string | null
  nombre: string
  tipo: string
  unidad: string
  stock: number
  stockMinimo: number
  ultimoCosto: number
  alerta: 'ok' | 'bajo' | 'critico'
}

const TIPO_LABELS: Record<string, string> = {
  materiales:   'Materiales',
  manoObra:     'Mano de Obra',
  equipos:      'Equipos',
  herramientas: 'Herramientas',
  subcontratos: 'Subcontratos',
  transportes:  'Transportes',
  herrajes:     'Herrajes',
  consumibles:  'Consumibles',
}

export function InventarioPanel({ recursos }: { recursos: RecursoStock[] }) {
  if (recursos.length === 0) return null

  const criticos = recursos.filter(r => r.alerta === 'critico').length
  const bajos = recursos.filter(r => r.alerta === 'bajo').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
          <Package className="w-5 h-5 text-blue-600" />
          Inventario
          {criticos > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              <XCircle className="w-3 h-3" /> {criticos} agotado{criticos !== 1 ? 's' : ''}
            </span>
          )}
          {bajos > 0 && (
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3 h-3" /> {bajos} bajo mínimo
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Recurso</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-28">Tipo</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-32">Stock actual</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-28">Mínimo</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-32">Último costo</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-24">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recursos.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-slate-800">{r.nombre}</span>
                    {r.codigo && <span className="ml-2 text-xs font-mono text-slate-400">{r.codigo}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{TIPO_LABELS[r.tipo] || r.tipo}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-sm font-semibold ${
                      r.alerta === 'critico' ? 'text-red-600' :
                      r.alerta === 'bajo' ? 'text-amber-600' : 'text-green-700'
                    }`}>
                      {r.stock} {r.unidad}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-sm text-slate-500">
                    {r.stockMinimo > 0 ? `${r.stockMinimo} ${r.unidad}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-700">
                    {r.ultimoCosto > 0 ? formatCurrency(r.ultimoCosto) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.alerta === 'critico' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        <XCircle className="w-3 h-3" /> Agotado
                      </span>
                    )}
                    {r.alerta === 'bajo' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-3 h-3" /> Bajo
                      </span>
                    )}
                    {r.alerta === 'ok' && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
