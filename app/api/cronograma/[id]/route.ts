import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const cronograma = await prisma.cronograma.findUnique({
    where: { id: numId },
    include: {
      proyecto: { select: { id: true, nombre: true, clienteId: true } },
      presupuesto: { select: { id: true, numero: true, total: true } },
      actividades: {
        include: {
          avances: { orderBy: { fecha: 'desc' }, take: 1 },
          dependencia: { select: { id: true, nombre: true } },
        },
        orderBy: [{ orden: 'asc' }, { fechaInicio: 'asc' }],
      },
    },
  })

  if (!cronograma) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Auto-calcular estado de actividades (atrasado si fecha_fin < hoy y avance < 100)
  const hoy = new Date()
  const actividadesConEstado = cronograma.actividades.map(a => {
    let estado = a.estado
    if (a.pctAvance < 100 && new Date(a.fechaFin) < hoy && a.estado !== 'Completado') {
      estado = 'Atrasado'
    }
    return { ...a, estado }
  })

  return NextResponse.json({ ...cronograma, actividades: actividadesConEstado })
})

export const PUT = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const {
    nombre, proyectoId, presupuestoId, fechaInicio, fechaFinEstimado,
    estado, notas, version, usarCalendarioLaboral, usarFeriados,
  } = body

  const cronograma = await prisma.cronograma.update({
    where: { id: numId },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(proyectoId !== undefined && { proyectoId: proyectoId ? parseInt(proyectoId) : null }),
      ...(presupuestoId !== undefined && { presupuestoId: presupuestoId ? parseInt(presupuestoId) : null }),
      ...(fechaInicio !== undefined && { fechaInicio: new Date(fechaInicio) }),
      ...(fechaFinEstimado !== undefined && { fechaFinEstimado: fechaFinEstimado ? new Date(fechaFinEstimado) : null }),
      ...(estado !== undefined && { estado }),
      ...(notas !== undefined && { notas }),
      ...(version !== undefined && { version }),
      ...(usarCalendarioLaboral !== undefined && { usarCalendarioLaboral: !!usarCalendarioLaboral }),
      ...(usarFeriados !== undefined && { usarFeriados: !!usarFeriados }),
    },
  })

  return NextResponse.json(cronograma)
})

export const DELETE = withPermiso('proyectos', 'editar', async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.cronograma.delete({ where: { id: numId } })
  return NextResponse.json({ ok: true })
})
