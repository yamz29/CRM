import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withPermiso('dashboard', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const unidad = await prisma.unidadGlobal.update({
      where: { id },
      data: {
        codigo: body.codigo?.trim().toLowerCase(),
        nombre: body.nombre?.trim(),
        simbolo: body.simbolo?.trim() || null,
        tipo: body.tipo,
        activo: body.activo,
      },
    })
    return NextResponse.json(unidad)
  } catch (error: unknown) {
    console.error(error)
    const msg = error instanceof Error && error.message.includes('Unique') ? 'Ya existe una unidad con ese código' : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

export const DELETE = withPermiso('dashboard', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.unidadGlobal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
})
