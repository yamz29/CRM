import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ApuEditor } from '@/components/apus/ApuEditor'

export default async function NuevoApuPage() {
  const [recursos, apusDisponibles] = await Promise.all([
    prisma.recurso.findMany({
      where: { activo: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, codigo: true, nombre: true, tipo: true, unidad: true, costoUnitario: true },
    }),
    prisma.apuCatalogo.findMany({
      where: { activo: true },
      orderBy: [{ capitulo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, codigo: true, nombre: true, unidad: true, precioVenta: true, capitulo: true },
    }),
  ])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/apus"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Nuevo APU</h1>
          <p className="text-slate-500 text-sm mt-0.5">Análisis de Precio Unitario</p>
        </div>
      </div>
      <ApuEditor recursos={recursos} apusDisponibles={apusDisponibles} mode="create" />
    </div>
  )
}
