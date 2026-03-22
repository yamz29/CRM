import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { SuccessBanner } from '@/components/ui/success-banner'
import { RecursosTable } from '@/components/recursos/RecursosTable'
import { InventarioPanel } from '@/components/recursos/InventarioPanel'
import { RecursosPageClient } from '@/components/recursos/RecursosPageClient'

interface SearchParams { msg?: string }

export default async function RecursosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { msg } = await searchParams

  const recursos = await prisma.recurso.findMany({
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  })

  const recursosStock = recursos
    .filter(r => r.controlarStock && r.activo)
    .map(r => {
      let alerta: 'ok' | 'bajo' | 'critico'
      if (r.stock <= 0 && r.stockMinimo >= 0) alerta = 'critico'
      else if (r.stockMinimo > 0 && r.stock <= r.stockMinimo) alerta = 'bajo'
      else alerta = 'ok'
      return { ...r, alerta }
    })
    .sort((a, b) => {
      const o = { critico: 0, bajo: 1, ok: 2 }
      return o[a.alerta] - o[b.alerta]
    })

  return (
    <div className="space-y-6">
      {msg === 'creado' && <SuccessBanner mensaje="Recurso creado exitosamente" />}
      {msg === 'actualizado' && <SuccessBanner mensaje="Recurso actualizado exitosamente" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de Recursos</h1>
          <p className="text-slate-500 mt-1">{recursos.length} recursos · base de datos maestra de costos</p>
        </div>
        <div className="flex items-center gap-2">
          <RecursosPageClient />
          <Link href="/recursos/nuevo">
            <Button><Plus className="w-4 h-4" /> Nuevo Recurso</Button>
          </Link>
        </div>
      </div>

      <InventarioPanel recursos={recursosStock} />
      <RecursosTable recursos={recursos} />
    </div>
  )
}
