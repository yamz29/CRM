import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLANTILLAS_DEFAULT } from '@/lib/plantillas-tareas-pipeline'
import { withPermiso } from '@/lib/with-permiso'

// GET: list all templates, optionally filtered by etapa
export const GET = withPermiso('tareas', 'ver', async (request: NextRequest) => {
  try {
    const etapa = request.nextUrl.searchParams.get('etapa')
    const plantillas = await prisma.plantillaTareaEtapa.findMany({
      where: etapa ? { etapa, activa: true } : { activa: true },
      orderBy: [{ etapa: 'asc' }, { orden: 'asc' }],
    })
    return NextResponse.json(plantillas)
  } catch (error) {
    console.error('Error fetching plantillas:', error)
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 })
  }
})

// POST: create a template, or seed defaults if body has { _seed: true }
export const POST = withPermiso('tareas', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()

    // Seed mode: insert defaults if table is empty
    if (body._seed) {
      const count = await prisma.plantillaTareaEtapa.count()
      if (count > 0) {
        return NextResponse.json({ message: `Ya existen ${count} plantillas, no se insertaron nuevas` })
      }
      await prisma.plantillaTareaEtapa.createMany({
        data: PLANTILLAS_DEFAULT.map(p => ({
          ...p,
          activa: true,
        })),
      })
      return NextResponse.json({ message: `${PLANTILLAS_DEFAULT.length} plantillas creadas` }, { status: 201 })
    }

    // Single create
    const { etapa, titulo, descripcion, prioridad, diasLimite, orden } = body
    if (!etapa || !titulo?.trim()) {
      return NextResponse.json({ error: 'Etapa y título son requeridos' }, { status: 400 })
    }

    const plantilla = await prisma.plantillaTareaEtapa.create({
      data: {
        etapa,
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        prioridad: prioridad || 'Media',
        diasLimite: diasLimite ? parseInt(String(diasLimite)) : null,
        orden: parseInt(String(orden ?? 0)) || 0,
      },
    })

    return NextResponse.json(plantilla, { status: 201 })
  } catch (error) {
    console.error('Error creating plantilla:', error)
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 })
  }
})
