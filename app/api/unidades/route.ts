import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('dashboard', 'ver', async () => {
  try {
    const unidades = await prisma.unidadGlobal.findMany({
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    })
    return NextResponse.json(unidades)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener unidades' }, { status: 500 })
  }
})

export const POST = withPermiso('dashboard', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    if (!body.codigo?.trim()) return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })
    if (!body.nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    const unidad = await prisma.unidadGlobal.create({
      data: {
        codigo: body.codigo.trim().toLowerCase(),
        nombre: body.nombre.trim(),
        simbolo: body.simbolo?.trim() || null,
        tipo: body.tipo || 'otro',
        activo: body.activo !== false,
      },
    })
    return NextResponse.json(unidad, { status: 201 })
  } catch (error: unknown) {
    console.error(error)
    const msg = error instanceof Error && error.message.includes('Unique') ? 'Ya existe una unidad con ese código' : 'Error al crear unidad'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})
