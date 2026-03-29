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
      wallId: number
      moduloId: number
      posicion: number
      nivel?: string
      alturaDesdeSupelo?: number
    }

    const { wallId, moduloId, posicion, nivel = 'base', alturaDesdeSupelo = 1400 } = body

    if (!wallId || !moduloId) {
      return NextResponse.json({ error: 'wallId y moduloId son requeridos' }, { status: 400 })
    }

    const placement = await prisma.kitchenModulePlacement.create({
      data: {
        kitchenProjectId: projectId,
        wallId,
        moduloId,
        posicion: posicion ?? 0,
        nivel,
        alturaDesdeSupelo,
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
