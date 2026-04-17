import { prisma } from '@/lib/prisma'
import { GanttProyectos } from './GanttProyectos'

interface SearchParams {
  archivados?: string
  estados?: string
}

export default async function GanttProyectosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { archivados, estados } = await searchParams
  const verArchivados = archivados === '1'
  const estadosFiltro = estados ? estados.split(',').filter(Boolean) : []

  const [proyectos, hitos] = await Promise.all([
    prisma.proyecto.findMany({
      where: {
        ...(verArchivados ? {} : { archivada: false }),
        ...(estadosFiltro.length > 0 ? { estado: { in: estadosFiltro } } : {}),
      },
      select: {
        id: true,
        nombre: true,
        tipoProyecto: true,
        estado: true,
        fechaInicio: true,
        fechaEstimada: true,
        avanceFisico: true,
        archivada: true,
        cliente: { select: { id: true, nombre: true } },
      },
      orderBy: [{ fechaInicio: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.hitoCronograma.findMany({
      orderBy: { fecha: 'asc' },
    }),
  ])

  const estadosExistentes = Array.from(new Set(proyectos.map(p => p.estado))).sort()

  const data = proyectos.map(p => ({
    id: p.id,
    nombre: p.nombre,
    cliente: p.cliente.nombre,
    tipoProyecto: p.tipoProyecto,
    estado: p.estado,
    fechaInicio: p.fechaInicio?.toISOString() ?? null,
    fechaEstimada: p.fechaEstimada?.toISOString() ?? null,
    avance: p.avanceFisico ?? 0,
    archivada: p.archivada,
  }))

  const hitosData = hitos.map(h => ({
    id: h.id,
    nombre: h.nombre,
    fecha: h.fecha.toISOString(),
    descripcion: h.descripcion,
    color: h.color,
    icono: h.icono,
    proyectoId: h.proyectoId,
  }))

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <GanttProyectos
        proyectos={data}
        hitos={hitosData}
        estadosExistentes={estadosExistentes}
        estadosFiltro={estadosFiltro}
        verArchivados={verArchivados}
      />
    </div>
  )
}
