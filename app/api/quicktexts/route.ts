import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

// GET /api/quicktexts — lista todas las plantillas
export const GET = withPermiso('dashboard', 'ver', async () => {
  try {
    const items = await prisma.presupuestoQuickText.findMany({
      orderBy: [{ categoria: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
    })
    return NextResponse.json(items)
  } catch (e) {
    console.error('Error fetching quicktexts:', e)
    return NextResponse.json({ error: 'Error al cargar plantillas' }, { status: 500 })
  }
})

// POST /api/quicktexts — crear nueva plantilla
export const POST = withPermiso('dashboard', 'editar', async (req: NextRequest) => {
  try {
    const { nombre, categoria, contenido, orden } = await req.json()
    if (!nombre?.trim() || !contenido?.trim()) {
      return NextResponse.json({ error: 'Nombre y contenido requeridos' }, { status: 400 })
    }
    const item = await prisma.presupuestoQuickText.create({
      data: {
        nombre: nombre.trim(),
        categoria: categoria?.trim() || null,
        contenido: contenido.trim(),
        orden: typeof orden === 'number' ? orden : 0,
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    console.error('Error creating quicktext:', e)
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 })
  }
})
