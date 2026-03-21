import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

function calcTotals(capitulos: any[], indirectoLineas: any[]) {
  let subtotalBase = 0
  for (const cap of capitulos) {
    for (const p of cap.partidas || []) {
      subtotalBase += parseFloat(String(p.subtotal)) || parseFloat(String(p.cantidad)) * parseFloat(String(p.precioUnitario)) || 0
    }
  }
  const subtotalIndirecto = indirectoLineas
    .filter((l: any) => l.activo !== false)
    .reduce((s: number, l: any) => s + subtotalBase * (parseFloat(String(l.porcentaje)) || 0) / 100, 0)
  return { subtotalBase, subtotalIndirecto, total: subtotalBase + subtotalIndirecto }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        cliente: true,
        proyecto: true,
        titulos: { orderBy: { orden: 'asc' } },
        indirectos: { orderBy: { orden: 'asc' } },
        capitulos: {
          include: {
            partidas: { include: { analisis: true }, orderBy: { orden: 'asc' } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    })
    if (!presupuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error('Error fetching presupuesto:', error)
    return NextResponse.json({ error: 'Error al obtener presupuesto' }, { status: 500 })
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const { clienteId, proyectoId, estado, notas, capitulos = [], titulos = [], indirectoLineas = [] } = body

    const { subtotalBase, total } = calcTotals(capitulos, indirectoLineas)

    // Delete existing data (cascade handles partidas/analisis)
    await prisma.capituloPresupuesto.deleteMany({ where: { presupuestoId: id } })
    await prisma.presupuestoTitulo.deleteMany({ where: { presupuestoId: id } })
    await prisma.presupuestoIndirectoLinea.deleteMany({ where: { presupuestoId: id } })

    // Update base presupuesto
    await prisma.presupuesto.update({
      where: { id },
      data: {
        clienteId: parseInt(String(clienteId)),
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        estado: estado || 'Borrador',
        notas: notas || null,
        subtotal: subtotalBase,
        total,
      },
    })

    // Create titulos
    const tituloIdMap: Record<number, number> = {}
    for (let ti = 0; ti < titulos.length; ti++) {
      const t = titulos[ti]
      const created = await prisma.presupuestoTitulo.create({
        data: { presupuestoId: id, nombre: t.nombre, orden: ti, observaciones: t.observaciones || null },
      })
      tituloIdMap[ti] = created.id
    }

    // Create capitulos + partidas
    for (let ci = 0; ci < capitulos.length; ci++) {
      const cap = capitulos[ci]
      const tituloId = cap.tituloIdx != null && tituloIdMap[cap.tituloIdx] != null ? tituloIdMap[cap.tituloIdx] : null
      const created = await prisma.capituloPresupuesto.create({
        data: {
          presupuestoId: id,
          tituloId,
          codigo: cap.codigo || null,
          nombre: cap.nombre,
          orden: ci,
        },
      })
      for (let pi = 0; pi < (cap.partidas || []).length; pi++) {
        const p = cap.partidas[pi]
        await prisma.partidaPresupuesto.create({
          data: {
            capituloId: created.id,
            codigo: p.codigo || null,
            descripcion: p.descripcion,
            unidad: p.unidad || 'gl',
            cantidad: parseFloat(String(p.cantidad)) || 0,
            precioUnitario: parseFloat(String(p.precioUnitario)) || 0,
            subtotal: parseFloat(String(p.subtotal)) || 0,
            observaciones: p.observaciones || null,
            orden: pi,
            ...(p.analisis ? {
              analisis: {
                create: {
                  materiales: p.analisis.materiales || 0,
                  manoObra: p.analisis.manoObra || 0,
                  equipos: p.analisis.equipos || 0,
                  subcontratos: p.analisis.subcontratos || 0,
                  transporte: p.analisis.transporte || 0,
                  desperdicio: p.analisis.desperdicio || 0,
                  indirectos: p.analisis.indirectos || 0,
                  utilidad: p.analisis.utilidad || 0,
                  costoDirecto: p.analisis.costoDirecto || 0,
                  costoTotal: p.analisis.costoTotal || 0,
                  precioSugerido: p.analisis.precioSugerido || 0,
                  margen: p.analisis.margen || 0,
                  detalleJson: p.analisis.detalle ? JSON.stringify(p.analisis.detalle) : null,
                },
              },
            } : {}),
          },
        })
      }
    }

    // Create indirecto lineas
    for (let li = 0; li < indirectoLineas.length; li++) {
      const l = indirectoLineas[li]
      await prisma.presupuestoIndirectoLinea.create({
        data: {
          presupuestoId: id,
          nombre: l.nombre,
          porcentaje: parseFloat(String(l.porcentaje)) || 0,
          orden: li,
          activo: l.activo !== false,
        },
      })
    }

    return NextResponse.json({ ok: true, total })
  } catch (error) {
    console.error('Error updating presupuesto v2:', error)
    return NextResponse.json({ error: 'Error al actualizar presupuesto' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.presupuesto.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting presupuesto:', error)
    return NextResponse.json({ error: 'Error al eliminar presupuesto' }, { status: 500 })
  }
}
