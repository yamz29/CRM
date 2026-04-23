import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
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
})
