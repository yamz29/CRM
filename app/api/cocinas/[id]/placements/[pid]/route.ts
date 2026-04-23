import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string; pid: string }> }

// ── PUT: Update placement position/nivel ─────────────────────────────────────

export const PUT = withPermiso('cocinas', 'editar', async (request: NextRequest, { params }: Ctx) => {
  try {
    const { id, pid } = await params
    const projectId = parseInt(id)
    const placementId = parseInt(pid)
    if (isNaN(projectId) || isNaN(placementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json() as {
      posicion?: number
      nivel?: string
      alturaDesdeSupelo?: number
      wallId?: number | null
      posX?: number
      posY?: number
    }
    const { posicion, nivel, alturaDesdeSupelo, wallId, posX, posY } = body

    const updated = await prisma.kitchenModulePlacement.update({
      where: { id: placementId, kitchenProjectId: projectId },
      data: {
        ...(posicion !== undefined && { posicion }),
        ...(nivel !== undefined && { nivel }),
        ...(alturaDesdeSupelo !== undefined && { alturaDesdeSupelo }),
        ...(wallId !== undefined && { wallId }),
        ...(posX !== undefined && { posX }),
        ...(posY !== undefined && { posY }),
      },
      include: {
        modulo: {
          select: {
            id: true,
            nombre: true,
            tipoModulo: true,
            ancho: true,
            alto: true,
            profundidad: true,
            colorAcabado: true,
            materialTableroId: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating placement:', error)
    return NextResponse.json({ error: 'Error al actualizar placement' }, { status: 500 })
  }
})

// ── DELETE: Remove placement ──────────────────────────────────────────────────

export const DELETE = withPermiso('cocinas', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  try {
    const { id, pid } = await params
    const projectId = parseInt(id)
    const placementId = parseInt(pid)
    if (isNaN(projectId) || isNaN(placementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    await prisma.kitchenModulePlacement.delete({
      where: { id: placementId, kitchenProjectId: projectId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting placement:', error)
    return NextResponse.json({ error: 'Error al eliminar placement' }, { status: 500 })
  }
})
