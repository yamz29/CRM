import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

// POST /api/cronograma/[id]/avance — registrar avance de una actividad
export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const cronogramaId = parseInt(id)
  if (isNaN(cronogramaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { actividadId, pctAvance, comentario, usuarioId } = body

  if (!actividadId || pctAvance === undefined) {
    return NextResponse.json({ error: 'actividadId y pctAvance son requeridos' }, { status: 400 })
  }

  const pct = Math.min(100, Math.max(0, parseFloat(pctAvance)))

  // Registrar avance histórico
  const avance = await prisma.avanceCronograma.create({
    data: {
      actividadId: parseInt(actividadId),
      pctAvance: pct,
      comentario,
      usuarioId: usuarioId ? parseInt(usuarioId) : null,
    },
  })

  // Actualizar % y estado en la actividad
  const hoy = new Date()
  let estado: string
  if (pct >= 100) {
    estado = 'Completado'
  } else if (pct > 0) {
    estado = 'En Ejecución'
  } else {
    estado = 'Pendiente'
  }

  const actividad = await prisma.actividadCronograma.update({
    where: { id: parseInt(actividadId) },
    data: { pctAvance: pct, estado },
  })

  // Verificar si atrasado (solo si no completado)
  if (estado !== 'Completado' && new Date(actividad.fechaFin) < hoy) {
    await prisma.actividadCronograma.update({
      where: { id: parseInt(actividadId) },
      data: { estado: 'Atrasado' },
    })
  }

  return NextResponse.json({ avance, actividad })
})
