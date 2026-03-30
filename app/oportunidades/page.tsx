import { prisma } from '@/lib/prisma'
import { PipelineClient } from '@/components/oportunidades/PipelineClient'
import { HelpDrawer } from '@/components/help/HelpDrawer'

export const dynamic = 'force-dynamic'

export default async function OportunidadesPage() {
  const [oportunidades, clientes] = await Promise.all([
    prisma.oportunidad.findMany({
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        presupuestos: { select: { id: true, numero: true, estado: true, total: true } },
        _count: { select: { actividades: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const serialized = oportunidades.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    fechaCierreEst: o.fechaCierreEst?.toISOString() ?? null,
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
      <PipelineClient oportunidades={serialized} clientes={clientes} />
    </div>
  )
}
