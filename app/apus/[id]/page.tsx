import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ApuEditor } from '@/components/apus/ApuEditor'

export default async function EditarApuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [apu, recursos, apusDisponibles] = await Promise.all([
    prisma.apuCatalogo.findUnique({
      where: { id },
      include: {
        recursos: {
          include: {
            recurso: true,
            apuHijo: { select: { id: true, codigo: true, nombre: true, unidad: true, precioVenta: true } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    }),
    prisma.recurso.findMany({
      where: { activo: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, codigo: true, nombre: true, tipo: true, unidad: true, costoUnitario: true },
    }),
    prisma.apuCatalogo.findMany({
      where: { activo: true, NOT: { id } },  // exclude self
      orderBy: [{ capitulo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, codigo: true, nombre: true, unidad: true, precioVenta: true, capitulo: true },
    }),
  ])

  if (!apu) notFound()

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Link href="/apus"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{apu.nombre}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {apu.codigo && <span className="font-mono mr-2">{apu.codigo}</span>}
            {apu.capitulo && <span>· {apu.capitulo}</span>}
          </p>
        </div>
      </div>
      <ApuEditor
        recursos={recursos}
        apusDisponibles={apusDisponibles}
        mode="edit"
        initialData={{
          id: apu.id,
          codigo: apu.codigo || '',
          nombre: apu.nombre,
          descripcion: apu.descripcion || '',
          capitulo: apu.capitulo || '',
          unidad: apu.unidad,
          indirectos: apu.indirectos,
          utilidad: apu.utilidad,
          desperdicio: apu.desperdicio,
          activo: apu.activo,
          observaciones: apu.observaciones || '',
          recursos: apu.recursos.map((ar) => ({
            tipoComponente: ar.tipoComponente,
            recursoId: ar.recursoId,
            apuHijoId: ar.apuHijoId,
            nombreSnapshot: ar.nombreSnapshot,
            unidadSnapshot: ar.unidadSnapshot,
            descripcionLibre: ar.descripcionLibre,
            unidadLibre: ar.unidadLibre,
            tipoLinea: ar.tipoLinea,
            cantidad: ar.cantidad,
            costoSnapshot: ar.costoSnapshot,
            subtotal: ar.subtotal,
            observaciones: ar.observaciones,
            recurso: ar.recurso,
            apuHijo: ar.apuHijo,
          })),
        }}
      />
    </div>
  )
}
