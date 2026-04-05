import { prisma } from '@/lib/prisma'
import { PipelineClient } from '@/components/oportunidades/PipelineClient'
import { HelpDrawer } from '@/components/help/HelpDrawer'

export const dynamic = 'force-dynamic'

export default async function OportunidadesPage() {
  // Auto-archive: Ganadas/Perdidas hace más de 30 días
  const treintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await prisma.oportunidad.updateMany({
    where: {
      etapa: { in: ['Ganado', 'Perdido'] },
      archivada: false,
      updatedAt: { lt: treintaDiasAtras },
    },
    data: { archivada: true, fechaArchivada: new Date() },
  })

  // Auto-delete: archivadas hace más de 6 meses
  const seisMesesAtras = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  await prisma.oportunidad.deleteMany({
    where: {
      archivada: true,
      fechaArchivada: { lt: seisMesesAtras },
    },
  })

  const [oportunidades, clientes, presupuestos, usuarios] = await Promise.all([
    prisma.oportunidad.findMany({
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        presupuestos: { select: { id: true, numero: true, estado: true, total: true } },
        _count: { select: { actividades: true, tareas: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.presupuesto.findMany({
      where: { oportunidadId: null },
      select: { id: true, numero: true, clienteId: true, estado: true, total: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const serialized = oportunidades.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    fechaCierreEst: o.fechaCierreEst?.toISOString() ?? null,
    fechaArchivada: o.fechaArchivada?.toISOString() ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline de Ventas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Seguimiento de oportunidades desde el primer contacto hasta el cierre
          </p>
        </div>
        <HelpDrawer slug="oportunidades" titulo="Pipeline de Ventas" />
      </div>
      <PipelineClient oportunidades={serialized} clientes={clientes} presupuestos={presupuestos} usuarios={usuarios} />
    </div>
  )
}
