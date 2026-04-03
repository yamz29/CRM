import { prisma } from '@/lib/prisma'
import { OrdenProduccionForm } from '@/components/produccion/OrdenProduccionForm'

export default async function NuevaOrdenPage() {
  const [espacios, proyectos] = await Promise.all([
    prisma.kitchenProject.findMany({
      include: {
        placements: {
          include: {
            modulo: {
              select: { id: true, nombre: true, tipoModulo: true, ancho: true, alto: true, profundidad: true, cantidad: true },
            },
          },
        },
        _count: { select: { placements: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.proyecto.findMany({
      where: { estado: { not: 'Cancelado' } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const espaciosSerial = espacios.map(e => ({
    id: e.id,
    nombre: e.nombre,
    layoutType: e.layoutType,
    moduloCount: e._count.placements,
    modulos: e.placements.map(p => ({
      placementId: p.id,
      moduloId: p.moduloId,
      nivel: p.nivel,
      nombre: p.modulo.nombre,
      tipoModulo: p.modulo.tipoModulo,
      ancho: p.modulo.ancho,
      alto: p.modulo.alto,
      profundidad: p.modulo.profundidad,
      cantidad: p.modulo.cantidad,
    })),
    createdAt: e.createdAt.toISOString(),
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Orden de Producción</h1>
        <p className="text-muted-foreground mt-1">
          Importa módulos de un espacio existente o crea items manualmente
        </p>
      </div>
      <OrdenProduccionForm espacios={espaciosSerial} proyectos={proyectos} />
    </div>
  )
}
