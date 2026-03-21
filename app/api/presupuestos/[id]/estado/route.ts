import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { estado } = body

    const estadosValidos = ['Borrador', 'Enviado', 'Aprobado', 'Rechazado']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const presupuesto = await prisma.presupuesto.update({
      where: { id },
      data: { estado },
    })

    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error('Error updating presupuesto estado:', error)
    return NextResponse.json(
      { error: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
}
