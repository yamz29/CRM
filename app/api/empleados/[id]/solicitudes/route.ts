import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('empleados', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const empleadoId = parseInt(idStr)
  if (isNaN(empleadoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const solicitudes = await prisma.solicitudPermiso.findMany({
      where: { empleadoId },
      orderBy: { fechaInicio: 'desc' },
    })
    return NextResponse.json(solicitudes)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 })
  }
})

export const POST = withPermiso('empleados', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const empleadoId = parseInt(idStr)
  if (isNaN(empleadoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    if (!body.tipo || !body.fechaInicio || !body.fechaFin) {
      return NextResponse.json({ error: 'Tipo, fecha de inicio y fecha de fin son obligatorios' }, { status: 400 })
    }

    const fechaInicio = new Date(body.fechaInicio)
    const fechaFin = new Date(body.fechaFin)
    const dias = body.dias !== undefined && body.dias !== ''
      ? parseFloat(body.dias)
      : Math.max(1, Math.round((fechaFin.getTime() - fechaInicio.getTime()) / 86400000) + 1)

    const solicitud = await prisma.solicitudPermiso.create({
      data: {
        empleadoId,
        tipo: body.tipo,
        fechaInicio,
        fechaFin,
        dias,
        motivo: body.motivo || null,
        estado: body.estado || 'Solicitado',
        aprobadoPor: body.aprobadoPor || null,
      },
    })
    return NextResponse.json(solicitud, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 })
  }
})
