import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { CronogramaView } from '@/components/cronograma/CronogramaView'
import { derivarEstados } from '@/lib/cronograma-estado'
import { GanttChart, ExternalLink, Plus } from 'lucide-react'

/**
 * Gantt del proyecto embebido en la pestaña Programación (#H23). Muestra el
 * cronograma más reciente del proyecto en modo solo lectura reutilizando
 * CronogramaView; para editar/imprimir se abre el cronograma completo.
 */
export async function GanttProyectoEmbed({ proyectoId }: { proyectoId: number }) {
  const cronograma = await prisma.cronograma.findFirst({
    where: { proyectoId },
    orderBy: { createdAt: 'desc' },
    include: {
      proyecto: { select: { id: true, nombre: true, fechaEstimada: true, estado: true } },
      presupuesto: { select: { id: true, numero: true } },
      actividades: {
        include: {
          avances: { orderBy: { fecha: 'desc' }, take: 3 },
          dependencia: { select: { id: true, nombre: true } },
        },
        orderBy: [{ orden: 'asc' }, { fechaInicio: 'asc' }],
      },
    },
  })

  if (!cronograma) {
    return (
      <div className="bg-card border border-border rounded-xl px-5 py-8 text-center">
        <GanttChart className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Este proyecto no tiene cronograma todavía.</p>
        <Link
          href={`/cronograma/nuevo?proyectoId=${proyectoId}`}
          className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Crear cronograma
        </Link>
      </div>
    )
  }

  const actividades = derivarEstados(cronograma.actividades)
  const readOnly = cronograma.proyecto?.estado === 'Cerrado'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GanttChart className="w-4 h-4 text-muted-foreground" />
          Cronograma · {cronograma.nombre}
        </h3>
        <Link
          href={`/cronograma/${cronograma.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          Abrir completo <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <CronogramaView
        cronograma={{ ...cronograma, actividades }}
        presupuestosDisponibles={[]}
        readOnly={readOnly}
      />
    </div>
  )
}
