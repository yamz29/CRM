import { prisma } from '@/lib/prisma'
import { FinanzasNav } from '@/components/contabilidad/FinanzasNav'
import { OverheadClient, type OverheadData } from './OverheadClient'
import { poolRealDelMes, rangoMes } from '@/lib/overhead-data'

const ESTADOS_ACTIVOS = ['Activo', 'En Ejecución']

/**
 * Pantalla de Overhead distribuido: reparto manual, mes a mes, de los gastos
 * fijos (oficina/taller/general) entre los proyectos activos.
 *
 * Server component: carga los datos del mes actual y los pasa al cliente.
 * La misma forma de datos que devuelve GET /api/contabilidad/overhead, para
 * que el cliente pueda recargar al cambiar de mes.
 */
async function cargarDatos(anio: number, mes: number): Promise<OverheadData> {
  const { desde, hasta } = rangoMes(anio, mes)

  const [poolReal, distribuciones, proyectosActivos, proyectosConGasto] = await Promise.all([
    poolRealDelMes(anio, mes),
    prisma.distribucionOverhead.findMany({
      where: { anio, mes },
      select: { proyectoId: true, porcentaje: true, montoAsignado: true },
    }),
    prisma.proyecto.findMany({
      where: { estado: { in: ESTADOS_ACTIVOS }, archivada: false },
      select: { id: true, nombre: true, estado: true },
    }),
    prisma.gastoProyecto.findMany({
      where: { fecha: { gte: desde, lt: hasta }, proyectoId: { not: null } },
      select: { proyectoId: true },
      distinct: ['proyectoId'],
    }),
  ])

  const ids = new Set<number>()
  for (const p of proyectosActivos) ids.add(p.id)
  for (const g of proyectosConGasto) if (g.proyectoId != null) ids.add(g.proyectoId)
  for (const d of distribuciones) ids.add(d.proyectoId)

  const idsFaltantes = [...ids].filter(id => !proyectosActivos.some(p => p.id === id))
  const proyectosExtra = idsFaltantes.length > 0
    ? await prisma.proyecto.findMany({
        where: { id: { in: idsFaltantes } },
        select: { id: true, nombre: true, estado: true },
      })
    : []

  const infoProyecto = new Map<number, { nombre: string; estado: string }>()
  for (const p of [...proyectosActivos, ...proyectosExtra]) {
    infoProyecto.set(p.id, { nombre: p.nombre, estado: p.estado })
  }
  const distPorProyecto = new Map(distribuciones.map(d => [d.proyectoId, d]))

  const proyectos = [...ids]
    .map(id => {
      const info = infoProyecto.get(id)
      const dist = distPorProyecto.get(id)
      return {
        proyectoId: id,
        nombre: info?.nombre ?? `Proyecto ${id}`,
        estado: info?.estado ?? '',
        porcentaje: dist?.porcentaje ?? 0,
        montoAsignado: dist?.montoAsignado ?? 0,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  return {
    anio,
    mes,
    poolReal,
    proyectos,
    totalAsignadoPct: proyectos.reduce((s, p) => s + p.porcentaje, 0),
    totalAsignadoMonto: proyectos.reduce((s, p) => s + p.montoAsignado, 0),
  }
}

export default async function OverheadPage() {
  const ahora = new Date()
  const anio = ahora.getUTCFullYear()
  const mes = ahora.getUTCMonth() + 1
  const datos = await cargarDatos(anio, mes)

  return (
    <>
      <FinanzasNav activo="contabilidad" />
      <div className="mt-4">
        <OverheadClient inicial={datos} />
      </div>
    </>
  )
}
