import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { poolRealDelMes, rangoMes } from '@/lib/overhead-data'
import { montoPorcentaje, totalPorcentaje, validarReparto } from '@/lib/overhead'

// Estados de proyecto que se consideran "activos" para recibir overhead.
const ESTADOS_ACTIVOS = ['Activo', 'En Ejecución']

/**
 * Conjunto de IDs de proyectos candidatos a recibir overhead en un mes:
 * activos (no archivados) ∪ con gasto en el mes ∪ con fila DistribucionOverhead.
 * Devuelve además el nombre/estado de cada uno.
 */
export async function proyectosCandidatosDelMes(anio: number, mes: number): Promise<
  { id: number; nombre: string; estado: string }[]
> {
  const { desde, hasta } = rangoMes(anio, mes)
  const [distribuciones, proyectosActivos, proyectosConGasto] = await Promise.all([
    prisma.distribucionOverhead.findMany({ where: { anio, mes }, select: { proyectoId: true } }),
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

  const info = new Map<number, { nombre: string; estado: string }>()
  for (const p of [...proyectosActivos, ...proyectosExtra]) {
    info.set(p.id, { nombre: p.nombre, estado: p.estado })
  }
  return [...ids]
    .map(id => ({ id, nombre: info.get(id)?.nombre ?? `Proyecto ${id}`, estado: info.get(id)?.estado ?? '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/**
 * GET /api/contabilidad/overhead?anio=YYYY&mes=M
 *
 * Devuelve el pool real overhead del mes y la lista de proyectos activos
 * con el % y monto asignado precargados (0 si no existe fila).
 *
 * "Proyectos activos del mes" = proyectos con estado activo, O con al menos
 * un gasto en el mes, O que ya tengan una fila DistribucionOverhead del mes.
 */
export const GET = withPermiso('contabilidad', 'ver', async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const anio = parseInt(sp.get('anio') ?? '')
  const mes = parseInt(sp.get('mes') ?? '')
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parámetros anio/mes inválidos' }, { status: 400 })
  }

  const [poolReal, distribuciones, candidatos] = await Promise.all([
    poolRealDelMes(anio, mes),
    prisma.distribucionOverhead.findMany({
      where: { anio, mes },
      select: { proyectoId: true, porcentaje: true, montoAsignado: true },
    }),
    proyectosCandidatosDelMes(anio, mes),
  ])

  const distPorProyecto = new Map(distribuciones.map(d => [d.proyectoId, d]))

  const proyectos = candidatos.map(c => {
    const dist = distPorProyecto.get(c.id)
    return {
      proyectoId: c.id,
      nombre: c.nombre,
      estado: c.estado,
      porcentaje: dist?.porcentaje ?? 0,
      montoAsignado: dist?.montoAsignado ?? 0,
    }
  })

  const totalAsignadoPct = proyectos.reduce((s, p) => s + p.porcentaje, 0)
  const totalAsignadoMonto = proyectos.reduce((s, p) => s + p.montoAsignado, 0)

  return NextResponse.json({
    anio, mes, poolReal, proyectos, totalAsignadoPct, totalAsignadoMonto,
  })
})

/**
 * POST /api/contabilidad/overhead
 * body { anio, mes, asignaciones: [{ proyectoId, porcentaje }] }
 *
 * Calcula el pool real server-side, valida que la suma de % sea <= 100,
 * hace upsert por (anio, mes, proyectoId) guardando porcentaje y
 * montoAsignado = poolReal * % / 100. Elimina filas cuyo % quede en 0.
 */
export const POST = withPermiso('contabilidad', 'editar', async (req: NextRequest) => {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const anio = parseInt(String(body.anio))
  const mes = parseInt(String(body.mes))
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parámetros anio/mes inválidos' }, { status: 400 })
  }

  const asignacionesRaw = Array.isArray(body.asignaciones) ? body.asignaciones : null
  if (!asignacionesRaw) {
    return NextResponse.json({ error: 'Falta el arreglo de asignaciones' }, { status: 400 })
  }

  // Normalizar: proyectoId entero, porcentaje numérico
  const asignaciones = asignacionesRaw.map((a: { proyectoId: unknown; porcentaje: unknown }) => ({
    proyectoId: parseInt(String(a.proyectoId)),
    porcentaje: Number(a.porcentaje) || 0,
  })).filter((a: { proyectoId: number }) => !isNaN(a.proyectoId))

  const errorValidacion = validarReparto(asignaciones)
  if (errorValidacion) {
    return NextResponse.json({ error: errorValidacion }, { status: 400 })
  }

  const poolReal = await poolRealDelMes(anio, mes)

  // Separar las que se guardan (% > 0) de las que se eliminan (% == 0)
  const aGuardar = asignaciones.filter((a: { porcentaje: number }) => a.porcentaje > 0)
  const aEliminar = asignaciones.filter((a: { porcentaje: number }) => a.porcentaje <= 0)

  await prisma.$transaction(async (tx) => {
    for (const a of aGuardar) {
      const montoAsignado = montoPorcentaje(poolReal, a.porcentaje)
      await tx.distribucionOverhead.upsert({
        where: { anio_mes_proyectoId: { anio, mes, proyectoId: a.proyectoId } },
        create: { anio, mes, proyectoId: a.proyectoId, porcentaje: a.porcentaje, montoAsignado },
        update: { porcentaje: a.porcentaje, montoAsignado },
      })
    }
    if (aEliminar.length > 0) {
      await tx.distribucionOverhead.deleteMany({
        where: { anio, mes, proyectoId: { in: aEliminar.map((a: { proyectoId: number }) => a.proyectoId) } },
      })
    }
  })

  return NextResponse.json({
    ok: true,
    poolReal,
    totalAsignadoPct: totalPorcentaje(aGuardar),
    totalAsignadoMonto: aGuardar.reduce((s: number, a: { porcentaje: number }) => s + montoPorcentaje(poolReal, a.porcentaje), 0),
  })
})
