import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/recursos/[id]/historial
// Returns price history for a resource, newest first
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const historial = await prisma.recursoPriceHistory.findMany({
      where: { recursoId: id },
      include: {
        loteImportacion: { select: { id: true, nombreArchivo: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(historial)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
  }
}
