import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// ── POST: Add a placement to kitchen project ──────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json() as {
      wallId?: number | null
      moduloId: number
      posicion?: number
      nivel?: string
      alturaDesdeSupelo?: number
      posX?: number
      posY?: number
    }

    const {
      wallId = null,
      moduloId,
      posicion = 0,
      nivel = wallId ? 'base' : 'isla',
      alturaDesdeSupelo = 1400,
      posX = 0,
      posY = 0,
    } = body

    if (!moduloId) {
      return NextResponse.json({ error: 'moduloId es requerido' }, { status: 400 })
    }

    const placement = await prisma.kitchenModulePlacement.create({
      data: {
        kitchenProjectId: projectId,
        wallId: wallId ?? null,
        moduloId,
        posicion,
        nivel,
        alturaDesdeSupelo,
        posX,
        posY,
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

    return NextResponse.json(placement, { status: 201 })
  } catch (error) {
    console.error('Error creating placement:', error)
    return NextResponse.json({ error: 'Error al crear placement' }, { status: 500 })
  }
}
