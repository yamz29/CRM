import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProyectoForm } from '@/components/proyectos/ProyectoForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [proyecto, clientes] = await Promise.all([
    prisma.proyecto.findUnique({ where: { id } }),
    prisma.cliente.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  if (!proyecto) notFound()

  const toDateString = (d: Date | null) => {
    if (!d) return ''
    return d.toISOString().split('T')[0]
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/proyectos/${proyecto.id}`}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Editar Proyecto</h1>
          <p className="text-slate-500 mt-0.5">{proyecto.nombre}</p>
        </div>
      </div>

      <ProyectoForm
        clientes={clientes}
        mode="edit"
        initialData={{
          id: proyecto.id,
          nombre: proyecto.nombre,
          clienteId: String(proyecto.clienteId),
          tipoProyecto: proyecto.tipoProyecto,
          ubicacion: proyecto.ubicacion || '',
          fechaInicio: toDateString(proyecto.fechaInicio),
          fechaEstimada: toDateString(proyecto.fechaEstimada),
          estado: proyecto.estado,
          descripcion: proyecto.descripcion || '',
          responsable: proyecto.responsable || '',
          presupuestoEstimado: proyecto.presupuestoEstimado ? String(proyecto.presupuestoEstimado) : '',
        }}
      />
    </div>
  )
}
