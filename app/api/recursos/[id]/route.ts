import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    const recurso = await prisma.recurso.findUnique({ where: { id } })
    if (!recurso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(recurso)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener recurso' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    const body = await request.json()
    const recurso = await prisma.recurso.update({
      where: { id },
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
        controlarStock: body.controlarStock === true || body.controlarStock === 'true',
        stock: parseFloat(body.stock) || 0,
        stockMinimo: parseFloat(body.stockMinimo) || 0,
        ultimoCosto: parseFloat(body.ultimoCosto) || 0,
      },
    })
    return NextResponse.json(recurso)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar recurso' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    await prisma.recurso.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar recurso' }, { status: 500 })
  }
}
