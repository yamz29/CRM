import { prisma } from '@/lib/prisma'
import { GanttProyectos } from './GanttProyectos'

interface SearchParams {
  archivados?: string
  pausados?: string
  estados?: string
}

export default async function GanttProyectosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { archivados, pausados, estados } = await searchParams
  const verArchivados = archivados === '1'
  const verPausados = pausados === '1'
  const estadosFiltro = estados ? estados.split(',').filter(Boolean) : []

  const [proyectos, hitos, tareasGantt] = await Promise.all([
    prisma.proyecto.findMany({
      where: {
        ...(verArchivados ? {} : { archivada: false }),
        // Excluir pausados por defecto (como los archivados) salvo que el
        // usuario los filtre explícitamente o active el toggle.
        ...(estadosFiltro.length > 0
          ? { estado: { in: estadosFiltro } }
          : verPausados ? {} : { estado: { not: 'Pausado' } }),
      },
      select: {
        id: true,
        codigo: true,
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
    prisma.tareaGantt.findMany({
      orderBy: { fechaInicio: 'asc' },
    }),
  ])

  const estadosExistentes = Array.from(new Set(proyectos.map(p => p.estado))).sort()

  const data = proyectos.map(p => ({
    id: p.id,
    codigo: p.codigo,
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

  const tareasData = tareasGantt.map(t => ({
    id: t.id,
    nombre: t.nombre,
    fechaInicio: t.fechaInicio.toISOString(),
    fechaFin: t.fechaFin.toISOString(),
    descripcion: t.descripcion,
    color: t.color,
    avance: t.avance,
    proyectoId: t.proyectoId,
  }))

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <GanttProyectos
        proyectos={data}
        hitos={hitosData}
        tareas={tareasData}
        estadosExistentes={estadosExistentes}
        estadosFiltro={estadosFiltro}
        verArchivados={verArchivados}
      />
    </div>
  )
}
