import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('nomina', 'ver', async (_request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const periodo = await prisma.periodoNomina.findUnique({
      where: { id },
      include: {
        lineas: {
          include: { empleado: true },
          orderBy: { id: 'asc' },
        },
      },
    })
    if (!periodo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(periodo)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener período' }, { status: 500 })
  }
})

export const PUT = withPermiso('nomina', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.estado !== undefined) data.estado = body.estado
    if (body.fechaPago !== undefined) data.fechaPago = body.fechaPago ? new Date(body.fechaPago) : null

    const periodo = await prisma.periodoNomina.update({ where: { id }, data })
    return NextResponse.json(periodo)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar período' }, { status: 500 })
  }
})

export const DELETE = withPermiso('nomina', 'editar', async (_request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const periodo = await prisma.periodoNomina.findUnique({ where: { id } })
    if (!periodo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (periodo.estado !== 'Borrador') {
      return NextResponse.json({ error: 'Solo se pueden eliminar períodos en Borrador' }, { status: 400 })
    }
    await prisma.periodoNomina.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar período' }, { status: 500 })
  }
})
