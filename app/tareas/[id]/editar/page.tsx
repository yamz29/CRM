import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
      <div className="flex items-center gap-4">
        <Link
          href="/tareas"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar Tarea</h1>
          <p className="text-slate-500 text-sm mt-0.5 line-clamp-1">{tarea.titulo}</p>
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
