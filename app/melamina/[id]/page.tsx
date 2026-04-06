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

  const [modulo, materialesDisponibles, tiposConfig] = await Promise.all([
    prisma.moduloMelaminaV2.findUnique({
      where: { id },
      include: {
        proyecto: { select: { id: true, nombre: true } },
        materialTablero: true,
        piezas: { orderBy: { orden: 'asc' } },
        materialesModulo: {
          orderBy: { orden: 'asc' },
          include: { material: true },
        },
      },
    }),
    prisma.materialMelamina.findMany({
      where: { activo: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.configuracion.findUnique({ where: { clave: 'tipos_modulo_melamina' } }),
  ])

  const tiposBase: string[] = tiposConfig
    ? JSON.parse(tiposConfig.valor)
    : ['Base con puertas', 'Base con cajones', 'Base mixto', 'Aéreo con puertas', 'Repisa', 'Columna', 'Closet', 'Baño', 'Oficina', 'Otro']
  const tiposModulo = tiposBase.includes('Repisa') ? tiposBase : [...tiposBase, 'Repisa']

  if (!modulo) notFound()

  const moduloData = {
    ...modulo,
    piezas: modulo.piezas.map((p) => ({
      ...p,
      observaciones: p.observaciones ?? '',
      material: p.material ?? '',
      tapacanto: (() => { try { return JSON.parse(p.tapacanto) } catch { return [] } })(),
      tapacantoColor: '',  // extracted by ModuloEditor from tapacanto array (_color: prefix)
    })),
    materialesModulo: modulo.materialesModulo.map((r) => ({
      ...r,
      observaciones: r.observaciones ?? '',
    })),
  }

  return (
    <ModuloEditor
      modulo={moduloData}
      materialesDisponibles={materialesDisponibles}
      tiposModulo={tiposModulo}
    />
  )
}
