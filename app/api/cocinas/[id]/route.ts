import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// ── GET: Full project with walls + placements ─────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const project = await prisma.kitchenProject.findUnique({
      where: { id: projectId },
      include: {
        paredes: { orderBy: { orden: 'asc' } },
        placements: {
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
          orderBy: { posicion: 'asc' },
        },
      },
    })

    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching kitchen project:', error)
    return NextResponse.json({ error: 'Error al obtener proyecto de cocina' }, { status: 500 })
  }
}

// ── PUT: Update project meta + full walls replacement ─────────────────────────

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json() as {
      nombre?: string
      layoutType?: string
      alturaMm?: number
      profBase?: number
      profAlto?: number
      paredes?: { nombre: string; longitud: number; orden?: number }[]
    }

    const { nombre, layoutType, alturaMm, profBase, profAlto, paredes } = body

    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.kitchenProject.update({
        where: { id: projectId },
        data: {
          ...(nombre !== undefined && { nombre: nombre.trim() }),
          ...(layoutType !== undefined && { layoutType }),
          ...(alturaMm !== undefined && { alturaMm }),
          ...(profBase !== undefined && { profBase }),
          ...(profAlto !== undefined && { profAlto }),
        },
      })

      if (paredes !== undefined) {
        // Delete old walls (cascades placements)
        await tx.kitchenWall.deleteMany({ where: { kitchenProjectId: projectId } })
        // Re-create walls
        for (let i = 0; i < paredes.length; i++) {
          const w = paredes[i]
          await tx.kitchenWall.create({
            data: {
              kitchenProjectId: projectId,
              nombre: w.nombre,
              longitud: w.longitud,
              orden: w.orden ?? i,
            },
          })
        }
      }

      return proj
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating kitchen project:', error)
    return NextResponse.json({ error: 'Error al actualizar proyecto de cocina' }, { status: 500 })
  }
}

// ── DELETE: Delete project ────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    await prisma.kitchenProject.delete({ where: { id: projectId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting kitchen project:', error)
    return NextResponse.json({ error: 'Error al eliminar proyecto de cocina' }, { status: 500 })
  }
}
