import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

/** Clamp a numeric field to [0, max]. Defaults max to Infinity. */
function safeNum(v: unknown, max = Infinity): number {
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : Math.min(max, Math.max(0, n))
}

function calcTotals(capitulos: any[], indirectoLineas: any[], descuentoTipo = 'ninguno', descuentoValor = 0, itbisActivo = false, itbisPorcentaje = 18) {
  let subtotalBase = 0
  for (const cap of capitulos) {
    for (const p of cap.partidas || []) {
      if (p.esNota) continue
      subtotalBase += safeNum(p.subtotal) || safeNum(p.cantidad) * safeNum(p.precioUnitario)
    }
  }
  const subtotalIndirecto = indirectoLineas
    .filter((l: any) => l.activo !== false)
    .reduce((s: number, l: any) => s + subtotalBase * safeNum(l.porcentaje, 100) / 100, 0)
  const subtotalAntesDescuento = subtotalBase + subtotalIndirecto
  const montoDescuento = descuentoTipo === 'porcentaje'
    ? subtotalAntesDescuento * safeNum(descuentoValor, 100) / 100
    : descuentoTipo === 'fijo' ? safeNum(descuentoValor) : 0
  const subtotalConDescuento = subtotalAntesDescuento - montoDescuento
  const montoItbis = itbisActivo ? subtotalConDescuento * safeNum(itbisPorcentaje, 100) / 100 : 0
  return { subtotalBase, subtotalIndirecto, total: subtotalConDescuento + montoItbis }
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
    const { clienteId, proyectoId, estado, notas, capitulos = [], titulos = [], indirectoLineas = [], descuentoTipo = 'ninguno', descuentoValor = 0, itbisActivo = false, itbisPorcentaje = 18 } = body

    const { subtotalBase, total } = calcTotals(capitulos, indirectoLineas, descuentoTipo, descuentoValor, itbisActivo, itbisPorcentaje)

    // All delete + recreate runs inside a single transaction.
    // If any step fails, the entire operation is rolled back — no data loss.
    await prisma.$transaction(async (tx) => {
      // Delete existing data (cascade handles partidas/analisis)
      await tx.capituloPresupuesto.deleteMany({ where: { presupuestoId: id } })
      await tx.presupuestoTitulo.deleteMany({ where: { presupuestoId: id } })
      await tx.presupuestoIndirectoLinea.deleteMany({ where: { presupuestoId: id } })

      // Update base presupuesto
      await tx.presupuesto.update({
        where: { id },
        data: {
          clienteId: parseInt(String(clienteId)),
          proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
          estado: estado || 'Borrador',
          notas: notas || null,
          subtotal: subtotalBase,
          descuentoTipo: descuentoTipo || 'ninguno',
          descuentoValor: safeNum(descuentoValor),
          itbisActivo: !!itbisActivo,
          itbisPorcentaje: safeNum(itbisPorcentaje, 100) || 18,
          total,
        },
      })

      // Recreate titulos
      const tituloIdMap: Record<number, number> = {}
      for (let ti = 0; ti < titulos.length; ti++) {
        const t = titulos[ti]
        const created = await tx.presupuestoTitulo.create({
          data: { presupuestoId: id, nombre: t.nombre, orden: ti, observaciones: t.observaciones || null },
        })
        tituloIdMap[ti] = created.id
      }

      // Recreate capitulos + partidas
      for (let ci = 0; ci < capitulos.length; ci++) {
        const cap = capitulos[ci]
        const tituloId = cap.tituloIdx != null && tituloIdMap[cap.tituloIdx] != null ? tituloIdMap[cap.tituloIdx] : null
        const capCreated = await tx.capituloPresupuesto.create({
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
          await tx.partidaPresupuesto.create({
            data: {
              capituloId: capCreated.id,
              codigo: p.codigo || null,
              descripcion: p.descripcion,
              unidad: p.unidad || 'gl',
              cantidad: p.esNota ? 0 : safeNum(p.cantidad),
              precioUnitario: p.esNota ? 0 : safeNum(p.precioUnitario),
              subtotal: p.esNota ? 0 : safeNum(p.subtotal),
              observaciones: p.observaciones || null,
              orden: pi,
              esNota: !!p.esNota,
              ...(p.analisis ? {
                analisis: {
                  create: {
                    materiales:      safeNum(p.analisis.materiales),
                    manoObra:        safeNum(p.analisis.manoObra),
                    equipos:         safeNum(p.analisis.equipos),
                    subcontratos:    safeNum(p.analisis.subcontratos),
                    transporte:      safeNum(p.analisis.transporte),
                    desperdicio:     safeNum(p.analisis.desperdicio),
                    indirectos:      safeNum(p.analisis.indirectos),
                    utilidad:        safeNum(p.analisis.utilidad),
                    costoDirecto:    safeNum(p.analisis.costoDirecto),
                    costoTotal:      safeNum(p.analisis.costoTotal),
                    precioSugerido:  safeNum(p.analisis.precioSugerido),
                    margen:          safeNum(p.analisis.margen),
                    detalleJson: p.analisis.detalle ? JSON.stringify(p.analisis.detalle) : null,
                  },
                },
              } : {}),
            },
          })
        }
      }

      // Recreate indirecto lineas
      for (let li = 0; li < indirectoLineas.length; li++) {
        const l = indirectoLineas[li]
        await tx.presupuestoIndirectoLinea.create({
          data: {
            presupuestoId: id,
            nombre: l.nombre,
            porcentaje: safeNum(l.porcentaje, 100),
            orden: li,
            activo: l.activo !== false,
          },
        })
      }
    })

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
