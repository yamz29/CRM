import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

/**
 * Genera actividades del cronograma a partir de un presupuesto.
 *
 * IMPORTANTE: Solo extrae la LISTA de trabajos (partidas) del presupuesto.
 * NO asigna fechas, NO calcula duraciones, NO genera WBS ni dependencias.
 * El usuario es quien define todo esto manualmente después.
 *
 * Se respeta:
 *   - Nombre (descripción de la partida)
 *   - Agrupación por capítulo (capituloNombre)
 *   - Orden original del presupuesto
 *   - Vínculo a la partida (partidaId)
 */
export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const cronogramaId = parseInt(id)
  if (isNaN(cronogramaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { presupuestoId } = body

  if (!presupuestoId) {
    return NextResponse.json({ error: 'presupuestoId es requerido' }, { status: 400 })
  }

  const cronograma = await prisma.cronograma.findUnique({
    where: { id: cronogramaId },
  })
  if (!cronograma) return NextResponse.json({ error: 'Cronograma no encontrado' }, { status: 404 })

  // Obtener capítulos y partidas del presupuesto
  const capitulos = await prisma.capituloPresupuesto.findMany({
    where: { presupuestoId: parseInt(presupuestoId) },
    include: {
      partidas: { orderBy: { orden: 'asc' } },
    },
    orderBy: { orden: 'asc' },
  })

  if (capitulos.length === 0) {
    return NextResponse.json({ error: 'El presupuesto no tiene partidas (V2)' }, { status: 400 })
  }

  // Eliminar actividades anteriores (si se regenera)
  await prisma.actividadCronograma.deleteMany({ where: { cronogramaId } })

  // Generar actividades sin fechas ni duración — el usuario las llena después.
  // Usamos la fecha de inicio del cronograma como placeholder requerido por el schema.
  const placeholderFecha = new Date(cronograma.fechaInicio)
  const actividadesData: {
    cronogramaId: number
    partidaId: number
    capituloNombre: string
    nombre: string
    duracion: number
    fechaInicio: Date
    fechaFin: Date
    pctAvance: number
    estado: string
    tipoDependencia: string
    orden: number
  }[] = []
  let orden = 0

  for (const cap of capitulos) {
    for (const partida of cap.partidas) {
      // Saltar notas (no son trabajo real)
      if (partida.esNota) continue

      actividadesData.push({
        cronogramaId,
        partidaId: partida.id,
        capituloNombre: cap.nombre,
        nombre: partida.descripcion,
        // Sin fechas reales: mismo día inicio=fin, duración=0 (el usuario lo define)
        duracion: 0,
        fechaInicio: placeholderFecha,
        fechaFin: placeholderFecha,
        pctAvance: 0,
        estado: 'Pendiente',
        tipoDependencia: 'FS',
        orden,
      })

      orden++
    }
  }

  await prisma.actividadCronograma.createMany({ data: actividadesData })

  // Vincular el presupuesto al cronograma (no modifica fechaFinEstimado — el usuario lo define)
  await prisma.cronograma.update({
    where: { id: cronogramaId },
    data: { presupuestoId: parseInt(presupuestoId) },
  })

  const actividades = await prisma.actividadCronograma.findMany({
    where: { cronogramaId },
    orderBy: [{ orden: 'asc' }],
  })

  return NextResponse.json({ ok: true, count: actividades.length, actividades })
})
