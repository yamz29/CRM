import { prisma } from '@/lib/prisma'
import { OrdenProduccionForm } from '@/components/produccion/OrdenProduccionForm'

export default async function NuevaOrdenPage() {
  const [presupuestos, proyectos] = await Promise.all([
    prisma.presupuesto.findMany({
      where: { estado: { in: ['Aprobado', 'Enviado', 'Borrador'] } },
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        _count: { select: { modulosMelamina: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.proyecto.findMany({
      where: { estado: { not: 'Cancelado' } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  // Filter presupuestos that have melamina V2 modules
  const presupuestosConModulos = await prisma.presupuesto.findMany({
    where: {
      id: { in: presupuestos.map(p => p.id) },
      modulosMelamina: { some: {} },  // This is the old ModuloMelamina
    },
    select: { id: true },
  })

  // Also get presupuestos that have ModuloMelaminaV2
  const presupuestosV2 = await prisma.moduloMelaminaV2.groupBy({
    by: ['presupuestoId'],
    where: { presupuestoId: { not: null } },
  })
  const presupuestoIdsConV2 = new Set(presupuestosV2.map(p => p.presupuestoId))

  const presupuestosSerial = presupuestos.map(p => ({
    ...p,
    tieneModulosV2: presupuestoIdsConV2.has(p.id),
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nueva Orden de Producción</h1>
        <p className="text-muted-foreground mt-1">
          Importa módulos de un presupuesto existente o crea items manualmente
        </p>
      </div>
      <OrdenProduccionForm presupuestos={presupuestosSerial} proyectos={proyectos} />
    </div>
  )
}
