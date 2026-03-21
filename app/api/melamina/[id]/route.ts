import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const modulo = await prisma.moduloMelaminaV2.findUnique({
      where: { id },
      include: { proyecto: { select: { id: true, nombre: true } } },
    })
    if (!modulo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(modulo)
  } catch (error) {
    console.error('Error fetching modulo:', error)
    return NextResponse.json({ error: 'Error al obtener módulo' }, { status: 500 })
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
    const {
      proyectoId,
      codigo,
      tipoModulo,
      nombre,
      ancho,
      alto,
      profundidad,
      material,
      colorAcabado,
      herrajes,
      cantidad,
      costoMateriales,
      costoManoObra,
      costoInstalacion,
      precioVenta,
      estadoProduccion,
      observaciones,
    } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const modulo = await prisma.moduloMelaminaV2.update({
      where: { id },
      data: {
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        codigo: codigo || null,
        tipoModulo: tipoModulo || 'Base',
        nombre: nombre.trim(),
        ancho: parseFloat(String(ancho)) || 0,
        alto: parseFloat(String(alto)) || 0,
        profundidad: parseFloat(String(profundidad)) || 0,
        material: material || 'Melamina Egger 18mm',
        colorAcabado: colorAcabado || null,
        herrajes: herrajes || null,
        cantidad: parseInt(String(cantidad)) || 1,
        costoMateriales: parseFloat(String(costoMateriales)) || 0,
        costoManoObra: parseFloat(String(costoManoObra)) || 0,
        costoInstalacion: parseFloat(String(costoInstalacion)) || 0,
        precioVenta: parseFloat(String(precioVenta)) || 0,
        estadoProduccion: estadoProduccion || 'Diseño',
        observaciones: observaciones || null,
      },
      include: {
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(modulo)
  } catch (error) {
    console.error('Error updating modulo:', error)
    return NextResponse.json({ error: 'Error al actualizar módulo' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.moduloMelaminaV2.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting modulo:', error)
    return NextResponse.json({ error: 'Error al eliminar módulo' }, { status: 500 })
  }
}
