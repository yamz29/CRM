import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const cronogramaId = parseInt(id)
  if (isNaN(cronogramaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { presupuestoId, duracionDefault } = body // duracionDefault: días si no hay rendimiento

  if (!presupuestoId) {
    return NextResponse.json({ error: 'presupuestoId es requerido' }, { status: 400 })
  }

  // Obtener el cronograma para saber fecha de inicio
  const cronograma = await prisma.cronograma.findUnique({
    where: { id: cronogramaId },
  })
  if (!cronograma) return NextResponse.json({ error: 'Cronograma no encontrado' }, { status: 404 })

  // Obtener capítulos y partidas del presupuesto con su análisis APU
  const capitulos = await prisma.capituloPresupuesto.findMany({
    where: { presupuestoId: parseInt(presupuestoId) },
    include: {
      partidas: {
        include: { analisis: { select: { rendimiento: true } } },
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: { orden: 'asc' },
  })

  if (capitulos.length === 0) {
    return NextResponse.json({ error: 'El presupuesto no tiene partidas (V2)' }, { status: 400 })
  }

  // Eliminar actividades anteriores del cronograma (si se regenera)
  await prisma.actividadCronograma.deleteMany({ where: { cronogramaId } })

  // Generar actividades por partida, agrupadas por capítulo
  const actividadesData = []
  let fechaActual = new Date(cronograma.fechaInicio)
  let orden = 0

  for (const cap of capitulos) {
    for (const partida of cap.partidas) {
      // Calcular duración: cantidad / rendimiento, o duracionDefault, mínimo 1 día
      const rendimiento = partida.analisis?.rendimiento
      let duracion: number

      if (rendimiento && rendimiento > 0) {
        duracion = Math.max(1, Math.ceil(partida.cantidad / rendimiento))
      } else {
        duracion = duracionDefault || 1
      }

      const fechaInicio = new Date(fechaActual)
      const fechaFin = new Date(fechaActual)
      fechaFin.setDate(fechaFin.getDate() + duracion - 1)

      actividadesData.push({
        cronogramaId,
        partidaId: partida.id,
        capituloNombre: cap.nombre,
        nombre: partida.descripcion,
        duracion,
        fechaInicio,
        fechaFin,
        pctAvance: 0,
        estado: 'Pendiente',
        tipoDependencia: 'FS',
        orden,
      })

      orden++
    }
  }

  await prisma.actividadCronograma.createMany({ data: actividadesData })

  // Actualizar fecha fin estimado del cronograma
  const ultimaFecha = actividadesData.at(-1)?.fechaFin
  if (ultimaFecha) {
    await prisma.cronograma.update({
      where: { id: cronogramaId },
      data: { fechaFinEstimado: ultimaFecha, presupuestoId: parseInt(presupuestoId) },
    })
  }

  const actividades = await prisma.actividadCronograma.findMany({
    where: { cronogramaId },
    orderBy: [{ orden: 'asc' }],
  })

  return NextResponse.json({ ok: true, count: actividades.length, actividades })
}
