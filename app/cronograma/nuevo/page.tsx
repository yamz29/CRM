import { prisma } from '@/lib/prisma'
import { NuevoCronogramaForm } from '@/components/cronograma/NuevoCronogramaForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NuevoCronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ proyectoId?: string; presupuestoId?: string }>
}) {
  const sp = await searchParams

  const [proyectos, presupuestos] = await Promise.all([
    prisma.proyecto.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.presupuesto.findMany({
      where: { estado: 'Aprobado' },
      select: { id: true, numero: true, total: true, proyecto: { select: { nombre: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cronograma"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nuevo Cronograma</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Crea vacío o genera actividades desde un presupuesto</p>
        </div>
      </div>

      <NuevoCronogramaForm
        proyectos={proyectos}
        presupuestos={presupuestos}
        defaultProyectoId={sp.proyectoId ? parseInt(sp.proyectoId) : undefined}
        defaultPresupuestoId={sp.presupuestoId ? parseInt(sp.presupuestoId) : undefined}
      />
    </div>
  )
}
