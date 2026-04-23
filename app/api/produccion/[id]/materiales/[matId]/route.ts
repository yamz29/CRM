import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string; matId: string }> }

export const PUT = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { matId } = await params
  const body = await req.json()

  try {
    const updated = await prisma.materialOrdenProduccion.update({
      where: { id: parseInt(matId) },
      data: {
        ...(body.cantidadComprada !== undefined && { cantidadComprada: body.cantidadComprada }),
        ...(body.cantidadRecibida !== undefined && { cantidadRecibida: body.cantidadRecibida }),
        ...(body.costoUnitario !== undefined && {
          costoUnitario: body.costoUnitario,
          costoTotal: body.costoUnitario * (body.cantidadRequerida ?? 0),
        }),
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.proveedor !== undefined && { proveedor: body.proveedor }),
        ...(body.notas !== undefined && { notas: body.notas }),
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar material' }, { status: 500 })
  }
})
