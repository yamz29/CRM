import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string; solicitudId: string }> }

export const PUT = withPermiso('empleados', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { solicitudId: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.tipo !== undefined) data.tipo = body.tipo
    if (body.fechaInicio !== undefined) data.fechaInicio = new Date(body.fechaInicio)
    if (body.fechaFin !== undefined) data.fechaFin = new Date(body.fechaFin)
    if (body.dias !== undefined) data.dias = parseFloat(body.dias)
    if (body.motivo !== undefined) data.motivo = body.motivo || null
    if (body.estado !== undefined) data.estado = body.estado
    if (body.aprobadoPor !== undefined) data.aprobadoPor = body.aprobadoPor || null

    const solicitud = await prisma.solicitudPermiso.update({ where: { id }, data })
    return NextResponse.json(solicitud)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar solicitud' }, { status: 500 })
  }
})

export const DELETE = withPermiso('empleados', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  const { solicitudId: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.solicitudPermiso.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar solicitud' }, { status: 500 })
  }
})
