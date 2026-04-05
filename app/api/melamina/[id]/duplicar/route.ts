import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const original = await prisma.moduloMelaminaV2.findUnique({
      where: { id },
      include: {
        piezas: { orderBy: { orden: 'asc' } },
        materialesModulo: { orderBy: { orden: 'asc' } },
      },
    })

    if (!original) return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 })

    const nuevo = await prisma.$transaction(async (tx) => {
      const copia = await tx.moduloMelaminaV2.create({
        data: {
          proyectoId: original.proyectoId,
          presupuestoId: original.presupuestoId,
          codigo: original.codigo ? `${original.codigo}-COPIA` : null,
          tipoModulo: original.tipoModulo,
          nombre: `${original.nombre} (Copia)`,
          ancho: original.ancho,
          alto: original.alto,
          profundidad: original.profundidad,
          cantidadPuertas: original.cantidadPuertas,
          cantidadCajones: original.cantidadCajones,
          material: original.material,
          colorAcabado: original.colorAcabado,
          cantidad: original.cantidad,
          costoMateriales: original.costoMateriales,
          costoManoObra: original.costoManoObra,
          costoInstalacion: original.costoInstalacion,
          precioVenta: original.precioVenta,
          estadoProduccion: 'Diseño',
          observaciones: original.observaciones,
          materialTableroId: original.materialTableroId,
          anchoPlanchaCm: original.anchoPlanchaCm,
          largoPlanchaCm: original.largoPlanchaCm,
        },
      })

      if (original.piezas.length > 0) {
        await tx.piezaModulo.createMany({
          data: original.piezas.map((p) => ({
            moduloId: copia.id,
            etiqueta: p.etiqueta,
            nombre: p.nombre,
            tipoPieza: p.tipoPieza,
            largo: p.largo,
            ancho: p.ancho,
            cantidad: p.cantidad,
            espesor: p.espesor,
            material: p.material,
            tapacanto: p.tapacanto,
            llevaMecanizado: p.llevaMecanizado,
            tipoMecanizado: p.tipoMecanizado,
            observaciones: p.observaciones,
            orden: p.orden,
          })),
        })
      }

      if (original.materialesModulo.length > 0) {
        await tx.materialModuloMelamina.createMany({
          data: original.materialesModulo.map((m) => ({
            moduloId: copia.id,
            materialId: m.materialId,
            tipo: m.tipo,
            unidad: m.unidad,
            cantidad: m.cantidad,
            costoSnapshot: m.costoSnapshot,
            subtotal: m.subtotal,
            observaciones: m.observaciones,
            orden: m.orden,
          })),
        })
      }

      return copia
    })

    return NextResponse.json({ id: nuevo.id, nombre: nuevo.nombre })
  } catch (error) {
    console.error('Error duplicating modulo:', error)
    return NextResponse.json({ error: 'Error al duplicar módulo' }, { status: 500 })
  }
}
