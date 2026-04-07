import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PresupuestoV2Builder } from '@/components/presupuestos/PresupuestoV2Builder'

export default async function EditarPresupuestoV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [presupuesto, clientes, proyectos, unidades] = await Promise.all([
    prisma.presupuesto.findUnique({
      where: { id },
      include: {
        titulos: { orderBy: { orden: 'asc' } },
        indirectos: { orderBy: { orden: 'asc' } },
        capitulos: {
          include: {
            partidas: { include: { analisis: true }, orderBy: { orden: 'asc' } },
          },
          orderBy: { orden: 'asc' },
        },
        cliente: true,
        proyecto: true,
      },
    }),
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.proyecto.findMany({
      select: { id: true, nombre: true, clienteId: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.unidadGlobal.findMany({
      select: { codigo: true },
      orderBy: { codigo: 'asc' },
    }),
  ])
  const unidadesList = unidades.map((u) => u.codigo)

  if (!presupuesto) notFound()

  // Map DB types to builder types
  // Build a reverse map: DB titulo id → index in titulos array
  const tituloIdToIdx: Record<number, number> = {}
  presupuesto.titulos.forEach((t, i) => { tituloIdToIdx[t.id] = i })

  const initialData = {
    id: presupuesto.id,
    clienteId: presupuesto.clienteId,
    proyectoId: presupuesto.proyectoId,
    estado: presupuesto.estado,
    notas: presupuesto.notas || '',
    descuentoTipo: presupuesto.descuentoTipo,
    descuentoValor: presupuesto.descuentoValor,
    itbisActivo: presupuesto.itbisActivo,
    itbisPorcentaje: presupuesto.itbisPorcentaje,
    titulos: presupuesto.titulos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      orden: t.orden,
      observaciones: t.observaciones || '',
    })),
    indirectoLineas: presupuesto.indirectos.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      porcentaje: l.porcentaje,
      activo: l.activo,
      orden: l.orden,
    })),
    capitulos: presupuesto.capitulos.map((cap) => ({
      id: cap.id,
      codigo: cap.codigo || '',
      nombre: cap.nombre,
      orden: cap.orden,
      tituloIdx: cap.tituloId != null ? (tituloIdToIdx[cap.tituloId] ?? null) : null,
      partidas: cap.partidas.map((p) => ({
        id: p.id,
        codigo: p.codigo || '',
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        subtotal: p.subtotal,
        observaciones: p.observaciones || '',
        orden: p.orden,
        esNota: p.esNota,
        analisis: p.analisis
          ? {
              materiales: p.analisis.materiales,
              manoObra: p.analisis.manoObra,
              equipos: p.analisis.equipos,
              subcontratos: p.analisis.subcontratos,
              transporte: p.analisis.transporte,
              desperdicio: p.analisis.desperdicio,
              indirectos: p.analisis.indirectos,
              utilidad: p.analisis.utilidad,
              costoDirecto: p.analisis.costoDirecto,
              costoTotal: p.analisis.costoTotal,
              precioSugerido: p.analisis.precioSugerido,
              margen: p.analisis.margen,
              detalle: p.analisis.detalleJson
                ? JSON.parse(p.analisis.detalleJson)
                : undefined,
            }
          : undefined,
      })),
    })),
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/presupuestos/${id}`}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar Presupuesto</h1>
          <p className="text-slate-500 text-sm mt-0.5">{presupuesto.numero}</p>
        </div>
      </div>

      <PresupuestoV2Builder
        clientes={clientes}
        proyectos={proyectos}
        unidadesGlobales={unidadesList}
        mode="edit"
        initialData={initialData}
      />
    </div>
  )
}
