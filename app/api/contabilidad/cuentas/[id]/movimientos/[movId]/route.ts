import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string; movId: string }> }

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, movId } = await params
  const cuentaId = parseInt(id)
  const movIdNum = parseInt(movId)

  if (isNaN(cuentaId) || isNaN(movIdNum)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const mov = await prisma.movimientoBancario.findUnique({ where: { id: movIdNum } })
    if (!mov || mov.cuentaBancariaId !== cuentaId) {
      return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
    }

    await prisma.movimientoBancario.delete({ where: { id: movIdNum } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting movimiento:', error)
    return NextResponse.json({ error: 'Error al eliminar movimiento' }, { status: 500 })
  }
}
