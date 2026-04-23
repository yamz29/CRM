import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withPermiso('melamina', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const {
      tipo, nombre, codigo, marca, proveedor,
      precio, moneda, unidad, anchoMm, largoMm, espesorMm,
      activo, observaciones,
    } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const material = await prisma.materialMelamina.update({
      where: { id },
      data: {
        tipo,
        nombre: nombre.trim(),
        codigo: codigo || null,
        marca: marca || null,
        proveedor: proveedor || null,
        precio: parseFloat(String(precio)) || 0,
        moneda: moneda || 'DOP',
        unidad: unidad || 'ud',
        anchoMm: anchoMm ? parseFloat(String(anchoMm)) : null,
        largoMm: largoMm ? parseFloat(String(largoMm)) : null,
        espesorMm: espesorMm ? parseFloat(String(espesorMm)) : null,
        activo: activo !== false,
        observaciones: observaciones || null,
      },
    })
    return NextResponse.json(material)
  } catch (error) {
    console.error('Error updating material melamina:', error)
    return NextResponse.json({ error: 'Error al actualizar material' }, { status: 500 })
  }
})

export const DELETE = withPermiso('melamina', 'editar', async (_request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.materialMelamina.update({
      where: { id },
      data: { activo: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting material melamina:', error)
    return NextResponse.json({ error: 'Error al eliminar material' }, { status: 500 })
  }
})
