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
      include: {
        proyecto: { select: { id: true, nombre: true } },
        materialTablero: true,
        piezas: { orderBy: { orden: 'asc' } },
        materialesModulo: {
          orderBy: { orden: 'asc' },
          include: { material: true },
        },
      },
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
      proyectoId, codigo, tipoModulo, nombre, ancho, alto, profundidad,
      cantidadPuertas, cantidadCajones, material, colorAcabado,
      cantidad, costoMateriales, costoManoObra, costoInstalacion, precioVenta,
      estadoProduccion, observaciones,
      materialTableroId, anchoPlanchaCm, largoPlanchaCm,
      piezas, materialesModulo,
    } = body

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    const modulo = await prisma.$transaction(async (tx) => {
      const updated = await tx.moduloMelaminaV2.update({
        where: { id },
        data: {
          proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
          codigo: codigo || null,
          tipoModulo: tipoModulo || 'Base con puertas',
          nombre: nombre.trim(),
          ancho: parseFloat(String(ancho)) || 0,
          alto: parseFloat(String(alto)) || 0,
          profundidad: parseFloat(String(profundidad)) || 0,
          cantidadPuertas: parseInt(String(cantidadPuertas)) || 0,
          cantidadCajones: parseInt(String(cantidadCajones)) || 0,
          material: material || '',
          colorAcabado: colorAcabado || null,
          cantidad: parseInt(String(cantidad)) || 1,
          costoMateriales: parseFloat(String(costoMateriales)) || 0,
          costoManoObra: parseFloat(String(costoManoObra)) || 0,
          costoInstalacion: parseFloat(String(costoInstalacion)) || 0,
          precioVenta: parseFloat(String(precioVenta)) || 0,
          estadoProduccion: estadoProduccion || 'Diseño',
          observaciones: observaciones || null,
          materialTableroId: materialTableroId ? parseInt(String(materialTableroId)) : null,
          anchoPlanchaCm: parseFloat(String(anchoPlanchaCm)) || 2440,
          largoPlanchaCm: parseFloat(String(largoPlanchaCm)) || 1830,
        },
      })

      if (Array.isArray(piezas)) {
        await tx.piezaModulo.deleteMany({ where: { moduloId: id } })
        if (piezas.length > 0) {
          await tx.piezaModulo.createMany({
            data: piezas.map((p: any, i: number) => ({
              moduloId: id,
              etiqueta: p.etiqueta || 'Otro',
              nombre: p.nombre || '',
              tipoPieza: p.tipoPieza || 'otro',
              largo: parseFloat(String(p.largo)) || 0,
              ancho: parseFloat(String(p.ancho)) || 0,
              cantidad: parseInt(String(p.cantidad)) || 1,
              espesor: parseFloat(String(p.espesor)) || 18,
              material: p.material || null,
              tapacanto: Array.isArray(p.tapacanto) ? JSON.stringify(p.tapacanto) : '[]',
              llevaMecanizado: p.llevaMecanizado === true,
              tipoMecanizado: p.tipoMecanizado || null,
              observaciones: p.observaciones || null,
              orden: i,
            })),
          })
        }
      }

      if (Array.isArray(materialesModulo)) {
        await tx.materialModuloMelamina.deleteMany({ where: { moduloId: id } })
        const validMateriales = materialesModulo.filter((r: any) => r.materialId)
        if (validMateriales.length > 0) {
          await tx.materialModuloMelamina.createMany({
            data: validMateriales.map((r: any, i: number) => ({
              moduloId: id,
              materialId: parseInt(String(r.materialId)),
              tipo: r.tipo || 'herraje',
              unidad: r.unidad || 'ud',
              cantidad: parseFloat(String(r.cantidad)) || 1,
              costoSnapshot: parseFloat(String(r.costoSnapshot)) || 0,
              subtotal: parseFloat(String(r.subtotal)) || 0,
              observaciones: r.observaciones || null,
              orden: i,
            })),
          })
        }
      }

      return updated
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
