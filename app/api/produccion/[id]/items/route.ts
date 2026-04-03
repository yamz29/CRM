import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  try {
    const item = await prisma.itemProduccion.create({
      data: {
        ordenId: parseInt(id),
        moduloId: body.moduloId ? parseInt(body.moduloId) : null,
        nombreModulo: body.nombreModulo || body.nombre,
        tipoModulo: body.tipoModulo || null,
        dimensiones: body.dimensiones || null,
        cantidad: body.cantidad || 1,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al agregar item' }, { status: 500 })
  }
}
