import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ModuloEditor } from '@/components/melamina/ModuloEditor'

export default async function ModuloDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [modulo, proyectos, recursosDisponibles] = await Promise.all([
    prisma.moduloMelaminaV2.findUnique({
      where: { id },
      include: {
        proyecto: { select: { id: true, nombre: true } },
        piezas: { orderBy: { orden: 'asc' } },
        recursosModulo: {
          orderBy: { orden: 'asc' },
          include: {
            recurso: { select: { id: true, nombre: true, unidad: true, costoUnitario: true, tipo: true } },
          },
        },
      },
    }),
    prisma.proyecto.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.recurso.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, unidad: true, costoUnitario: true, tipo: true, codigo: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  if (!modulo) notFound()

  const moduloData = {
    ...modulo,
    piezas: modulo.piezas.map((p) => ({
      ...p,
      tapacanto: (() => { try { return JSON.parse(p.tapacanto) } catch { return [] } })(),
    })),
  }

  return (
    <ModuloEditor
      modulo={moduloData}
      proyectos={proyectos}
      recursosDisponibles={recursosDisponibles}
    />
  )
}
