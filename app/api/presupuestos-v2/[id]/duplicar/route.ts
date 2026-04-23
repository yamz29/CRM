import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withPermiso('presupuestos', 'editar', async (_request: NextRequest, { params }: Ctx) => {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Load source presupuesto with full structure
    const source = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        titulos: { orderBy: { orden: 'asc' } },
        indirectos: { orderBy: { orden: 'asc' } },
        capitulos: {
          orderBy: { orden: 'asc' },
          include: {
            partidas: {
              orderBy: { orden: 'asc' },
              include: { analisis: true },
            },
          },
        },
      },
    })
    if (!source) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

    // Generate new numero
    const year = new Date().getFullYear()
    const existing = await prisma.presupuesto.findMany({
      where: { numero: { startsWith: `COT-${year}-` } },
      select: { numero: true },
    })
    const usedSeqs = existing.map(p => parseInt(p.numero.split('-')[2] ?? '0')).filter(n => !isNaN(n))
    const maxSeq = usedSeqs.length > 0 ? Math.max(...usedSeqs) : 0
    const numero = `COT-${year}-${String(maxSeq + 1).padStart(3, '0')}`

    // Create new presupuesto
    const nuevo = await prisma.presupuesto.create({
      data: {
        numero,
        clienteId: source.clienteId,
        proyectoId: source.proyectoId,
        estado: 'Borrador',
        notas: source.notas,
        subtotal: source.subtotal,
        descuentoTipo: source.descuentoTipo,
        descuentoValor: source.descuentoValor,
        itbisActivo: source.itbisActivo,
        itbisPorcentaje: source.itbisPorcentaje,
        total: source.total,
      },
    })

    // Copy titulos and build old-id → new-id map
    const tituloIdMap: Record<number, number> = {}
    for (const t of source.titulos) {
      const created = await prisma.presupuestoTitulo.create({
        data: {
          presupuestoId: nuevo.id,
          nombre: t.nombre,
          orden: t.orden,
          observaciones: t.observaciones,
        },
      })
      tituloIdMap[t.id] = created.id
    }

    // Copy capitulos + partidas + analisis
    for (const cap of source.capitulos) {
      const newCap = await prisma.capituloPresupuesto.create({
        data: {
          presupuestoId: nuevo.id,
          tituloId: cap.tituloId != null ? (tituloIdMap[cap.tituloId] ?? null) : null,
          codigo: cap.codigo,
          nombre: cap.nombre,
          orden: cap.orden,
        },
      })

      for (const p of cap.partidas) {
        await prisma.partidaPresupuesto.create({
          data: {
            capituloId: newCap.id,
            codigo: p.codigo,
            descripcion: p.descripcion,
            unidad: p.unidad,
            cantidad: p.cantidad,
            precioUnitario: p.precioUnitario,
            subtotal: p.subtotal,
            observaciones: p.observaciones,
            orden: p.orden,
            esNota: p.esNota,
            ...(p.analisis ? {
              analisis: {
                create: {
                  materiales: p.analisis.materiales,
                  manoObra: p.analisis.manoObra,
                  equipos: p.analisis.equipos,
                  subcontratos: p.analisis.subcontratos,
                  transporte: p.analisis.transporte,
                  desperdicio: p.analisis.desperdicio,
                  indirectos: p.analisis.indirectos,
                  utilidad: p.analisis.utilidad,
                  costoDirecto: p.analisis.costoDirecto,
                  costoTotal: p.analisis.costoTotal,
                  precioSugerido: p.analisis.precioSugerido,
                  margen: p.analisis.margen,
                  detalleJson: p.analisis.detalleJson,
                },
              },
            } : {}),
          },
        })
      }
    }

    // Copy indirecto lineas
    for (const l of source.indirectos) {
      await prisma.presupuestoIndirectoLinea.create({
        data: {
          presupuestoId: nuevo.id,
          nombre: l.nombre,
          porcentaje: l.porcentaje,
          orden: l.orden,
          activo: l.activo,
        },
      })
    }

    return NextResponse.json({ id: nuevo.id, numero: nuevo.numero }, { status: 201 })
  } catch (error) {
    console.error('Error duplicando presupuesto:', error)
    return NextResponse.json({ error: 'Error al duplicar presupuesto' }, { status: 500 })
  }
})
