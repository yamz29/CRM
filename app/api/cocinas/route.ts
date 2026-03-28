import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── GET: List all kitchen projects ───────────────────────────────────────────

export async function GET() {
  try {
    const projects = await prisma.kitchenProject.findMany({
      include: {
        paredes: { select: { id: true } },
        placements: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = projects.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      layoutType: p.layoutType,
      alturaMm: p.alturaMm,
      profBase: p.profBase,
      profAlto: p.profAlto,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      paredesCount: p.paredes.length,
      placementsCount: p.placements.length,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching kitchen projects:', error)
    return NextResponse.json({ error: 'Error al obtener proyectos de cocina' }, { status: 500 })
  }
}

// ── POST: Create kitchen project ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      nombre: string
      layoutType?: string
      alturaMm?: number
      profBase?: number
      profAlto?: number
      paredes?: { nombre: string; longitud: number; orden?: number }[]
    }

    const { nombre, layoutType = 'lineal', alturaMm = 2400, profBase = 580, profAlto = 350, paredes = [] } = body

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    const project = await prisma.kitchenProject.create({
      data: {
        nombre: nombre.trim(),
        layoutType,
        alturaMm,
        profBase,
        profAlto,
        paredes: {
          create: paredes.map((w, i) => ({
            nombre: w.nombre,
            longitud: w.longitud,
            orden: w.orden ?? i,
          })),
        },
      },
      include: {
        paredes: true,
        placements: true,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating kitchen project:', error)
    return NextResponse.json({ error: 'Error al crear proyecto de cocina' }, { status: 500 })
  }
}
