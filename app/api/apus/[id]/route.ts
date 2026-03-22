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
    const apu = await prisma.apuCatalogo.findUnique({
      where: { id },
      include: { recursos: { include: { recurso: true }, orderBy: { orden: 'asc' } } },
    })
    if (!apu) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(apu)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener APU' }, { status: 500 })
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
    const { recursos = [], ...apuData } = body

    const costoDirecto = recursos.reduce((s: number, r: any) => s + (parseFloat(r.subtotal) || 0), 0)
    const costoTotal = costoDirecto * (1 + (parseFloat(apuData.indirectos) || 0) / 100)
    const precioVenta = costoTotal * (1 + (parseFloat(apuData.utilidad) || 0) / 100)

    // Delete existing recursos and recreate
    await prisma.apuRecurso.deleteMany({ where: { apuId: id } })

    const apu = await prisma.apuCatalogo.update({
      where: { id },
      data: {
        codigo: apuData.codigo || null,
        nombre: apuData.nombre,
        descripcion: apuData.descripcion || null,
        capitulo: apuData.capitulo || null,
        unidad: apuData.unidad || 'gl',
        indirectos: parseFloat(apuData.indirectos) || 0,
        utilidad: parseFloat(apuData.utilidad) || 0,
        desperdicio: parseFloat(apuData.desperdicio) || 0,
        costoDirecto,
        costoTotal,
        precioVenta,
        activo: apuData.activo !== false,
        observaciones: apuData.observaciones || null,
        recursos: {
          create: recursos.map((r: any, i: number) => ({
            recursoId: r.recursoId ? parseInt(r.recursoId) : null,
            descripcionLibre: r.descripcionLibre || null,
            unidadLibre: r.unidadLibre || null,
            tipoLinea: r.tipoLinea || null,
            cantidad: parseFloat(r.cantidad) || 0,
            costoSnapshot: parseFloat(r.costoSnapshot) || 0,
            subtotal: parseFloat(r.subtotal) || 0,
            orden: i,
            observaciones: r.observaciones || null,
          })),
        },
      },
      include: { recursos: { include: { recurso: true }, orderBy: { orden: 'asc' } } },
    })

    return NextResponse.json(apu)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar APU' }, { status: 500 })
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
    await prisma.apuCatalogo.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar APU' }, { status: 500 })
  }
}
