import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('melamina', 'ver', async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')

  const materiales = await prisma.materialMelamina.findMany({
    where: {
      activo: true,
      ...(tipo ? { tipo } : {}),
    },
    orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
  })
  return NextResponse.json(materiales)
})

export const POST = withPermiso('melamina', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    const {
      tipo, nombre, codigo, marca, proveedor,
      precio, moneda, unidad, anchoMm, largoMm, espesorMm,
      observaciones,
    } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }
    if (!['tablero', 'canto', 'herraje'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const material = await prisma.materialMelamina.create({
      data: {
        tipo,
        nombre: nombre.trim(),
        codigo: codigo || null,
        marca: marca || null,
        proveedor: proveedor || null,
        precio: parseFloat(String(precio)) || 0,
        moneda: moneda || 'DOP',
        unidad: unidad || (tipo === 'tablero' ? 'pl' : tipo === 'canto' ? 'rollo' : 'ud'),
        anchoMm: anchoMm ? parseFloat(String(anchoMm)) : null,
        largoMm: largoMm ? parseFloat(String(largoMm)) : null,
        espesorMm: espesorMm ? parseFloat(String(espesorMm)) : null,
        observaciones: observaciones || null,
      },
    })
    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Error creating material melamina:', error)
    return NextResponse.json({ error: 'Error al crear material' }, { status: 500 })
  }
})
