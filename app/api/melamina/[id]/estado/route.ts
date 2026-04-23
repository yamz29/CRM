import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withPermiso('melamina', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const { estadoProduccion } = body

    if (!estadoProduccion) {
      return NextResponse.json({ error: 'Estado requerido' }, { status: 400 })
    }

    const modulo = await prisma.moduloMelaminaV2.update({
      where: { id },
      data: { estadoProduccion },
    })

    return NextResponse.json(modulo)
  } catch (error) {
    console.error('Error updating estado:', error)
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
  }
})
