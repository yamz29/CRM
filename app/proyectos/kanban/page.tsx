import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, List } from 'lucide-react'
import { KanbanClient } from './KanbanClient'

/**
 * /proyectos/kanban — vista pipeline de proyectos.
 *
 * 7 columnas (estado). Drag & drop para mover entre estados activos.
 * Los archivados se ocultan. El estado 'Cerrado' es terminal — no se
 * puede mover para adentro/afuera con drag (requiere modal con
 * validaciones desde el detalle del proyecto).
 */
export default async function ProyectosKanbanPage() {
  const proyectos = await prisma.proyecto.findMany({
    where: { archivada: false },
    include: {
      cliente: { select: { id: true, nombre: true } },
      _count: { select: { presupuestos: true, facturas: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/proyectos"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/40">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pipeline de proyectos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Arrastra una tarjeta entre columnas para cambiar su estado.
              <span className="hidden md:inline"> Los proyectos cerrados son terminales — usa el modal de cierre desde el detalle para entrar/salir.</span>
            </p>
          </div>
        </div>
        <Link href="/proyectos">
          <Button variant="outline" size="sm">
            <List className="w-4 h-4" /> Ver lista
          </Button>
        </Link>
      </div>

      {/* Kanban */}
      <KanbanClient
        proyectos={proyectos.map(p => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          estado: p.estado,
          ubicacion: p.ubicacion,
          fechaInicio: p.fechaInicio?.toISOString() ?? null,
          fechaEstimada: p.fechaEstimada?.toISOString() ?? null,
          avanceFisico: p.avanceFisico,
          presupuestoEstimado: p.presupuestoEstimado,
          responsable: p.responsable,
          cliente: p.cliente ? { id: p.cliente.id, nombre: p.cliente.nombre } : null,
          countPresupuestos: p._count.presupuestos,
          countFacturas: p._count.facturas,
        }))}
      />
    </div>
  )
}
