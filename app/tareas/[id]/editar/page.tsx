import { prisma } from '@/lib/prisma'
import { BackButton } from '@/components/ui/back-button'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TareaForm } from '@/components/tareas/TareaForm'

export default async function EditarTareaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [tarea, clientes, proyectos, usuarios] = await Promise.all([
    prisma.tarea.findUnique({ where: { id } }),
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.proyecto.findMany({
      select: { id: true, nombre: true, clienteId: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  if (!tarea) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumbs items={[{ label: 'Tareas', href: '/tareas' }, { label: `Editar · ${tarea.titulo}` }]} />
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/tareas" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Tarea</h1>
          <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{tarea.titulo}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <TareaForm
            clientes={clientes}
            proyectos={proyectos}
            usuarios={usuarios}
            mode="edit"
            initialData={{
              id: tarea.id,
              titulo: tarea.titulo,
              descripcion: tarea.descripcion || '',
              clienteId: tarea.clienteId,
              proyectoId: tarea.proyectoId,
              asignadoId: tarea.asignadoId,
              fechaLimite: tarea.fechaLimite,
              prioridad: tarea.prioridad,
              estado: tarea.estado,
              responsable: tarea.responsable,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
