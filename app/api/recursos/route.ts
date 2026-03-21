import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')
  const activo = searchParams.get('activo')

  try {
    const recursos = await prisma.recurso.findMany({
      where: {
        ...(tipo ? { tipo } : {}),
        ...(activo !== null ? { activo: activo !== 'false' } : {}),
      },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    })
    return NextResponse.json(recursos)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener recursos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const recurso = await prisma.recurso.create({
      data: {
        codigo: body.codigo || null,
        nombre: body.nombre,
        tipo: body.tipo || 'materiales',
        categoria: body.categoria || null,
        subcategoria: body.subcategoria || null,
        unidad: body.unidad || 'gl',
        costoUnitario: parseFloat(body.costoUnitario) || 0,
        proveedor: body.proveedor || null,
        marca: body.marca || null,
        activo: body.activo !== false,
        observaciones: body.observaciones || null,
      },
    })
    return NextResponse.json(recurso, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear recurso' }, { status: 500 })
  }
}
