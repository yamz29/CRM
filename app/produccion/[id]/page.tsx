import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { OrdenProduccionDetail } from '@/components/produccion/OrdenProduccionDetail'

export default async function OrdenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: parseInt(id) },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      items: {
        orderBy: { createdAt: 'asc' },
      },
      materiales: {
        include: { material: { select: { id: true, nombre: true, tipo: true } } },
        orderBy: { nombre: 'asc' },
      },
    },
  })

  if (!orden) notFound()

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })

  // Fetch piezas for corte/canteo/mecanización stages
  // Get all moduloIds from this order's items
  const moduloIds = orden.items
    .map(i => i.moduloId)
    .filter((id): id is number => id !== null)

  let piezas: {
    id: number
    nombre: string
    etiqueta: string
    largo: number
    ancho: number
    cantidad: number
    espesor: number
    material: string | null
    tapacanto: string
    llevaMecanizado: boolean
    tipoMecanizado: string | null
    moduloNombre: string
  }[] = []

  if (moduloIds.length > 0) {
    const rawPiezas = await prisma.piezaModulo.findMany({
      where: { moduloId: { in: moduloIds } },
      include: {
        modulo: { select: { nombre: true } },
      },
      orderBy: [{ moduloId: 'asc' }, { orden: 'asc' }],
    })

    piezas = rawPiezas.map(p => ({
      id: p.id,
      nombre: p.nombre,
      etiqueta: p.etiqueta,
      largo: p.largo,
      ancho: p.ancho,
      cantidad: p.cantidad,
      espesor: p.espesor,
      material: p.material,
      tapacanto: p.tapacanto,
      llevaMecanizado: p.llevaMecanizado,
      tipoMecanizado: p.tipoMecanizado,
      moduloNombre: p.modulo.nombre,
    }))
  }

  // Serialize dates
  const ordenSerial = {
    ...orden,
    fechaInicio: orden.fechaInicio?.toISOString() || null,
    fechaEstimada: orden.fechaEstimada?.toISOString() || null,
    fechaCompletada: orden.fechaCompletada?.toISOString() || null,
    createdAt: orden.createdAt.toISOString(),
    updatedAt: orden.updatedAt.toISOString(),
    items: orden.items.map(i => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    materiales: orden.materiales.map(m => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  }

  return <OrdenProduccionDetail orden={ordenSerial} usuarios={usuarios} piezas={piezas} />
}
