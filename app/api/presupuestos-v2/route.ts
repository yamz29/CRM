import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── helpers ───────────────────────────────────────────────────────────────────

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const proyectoId = searchParams.get('proyectoId')
    const clienteId = searchParams.get('clienteId')

    const where: Record<string, unknown> = {}
    if (proyectoId) where.proyectoId = parseInt(proyectoId)
    if (clienteId) where.clienteId = parseInt(clienteId)

    const presupuestos = await prisma.presupuesto.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        capitulos: {
          include: { partidas: { orderBy: { orden: 'asc' } } },
          orderBy: { orden: 'asc' },
        },
        titulos: { orderBy: { orden: 'asc' } },
        indirectos: { orderBy: { orden: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(presupuestos)
  } catch (error) {
    console.error('Error fetching presupuestos:', error)
    return NextResponse.json({ error: 'Error al obtener presupuestos' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clienteId, proyectoId, estado, notas, capitulos = [], titulos = [], indirectoLineas = [], descuentoTipo = 'ninguno', descuentoValor = 0, itbisActivo = false, itbisPorcentaje = 18 } = body

    if (!clienteId) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })

    const year = new Date().getFullYear()
    const existing = await prisma.presupuesto.findMany({
      where: { numero: { startsWith: `COT-${year}-` } },
      select: { numero: true },
    })
    const usedSeqs = existing.map(p => parseInt(p.numero.split('-')[2] ?? '0')).filter(n => !isNaN(n))
    const maxSeq = usedSeqs.length > 0 ? Math.max(...usedSeqs) : 0
    const numero = `COT-${year}-${String(maxSeq + 1).padStart(3, '0')}`

    const { subtotalBase, total } = calcTotals(capitulos, indirectoLineas, descuentoTipo, descuentoValor, itbisActivo, itbisPorcentaje)

    const presupuesto = await prisma.$transaction(async (tx) => {
      const created = await tx.presupuesto.create({
        data: {
          numero,
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

      // Create titulos and keep id map
      const tituloIdMap: Record<number, number> = {}
      for (let ti = 0; ti < titulos.length; ti++) {
        const t = titulos[ti]
        const t2 = await tx.presupuestoTitulo.create({
          data: { presupuestoId: created.id, nombre: t.nombre, orden: ti, observaciones: t.observaciones || null },
        })
        tituloIdMap[ti] = t2.id
      }

      // Create capitulos with tituloId
      for (let ci = 0; ci < capitulos.length; ci++) {
        const cap = capitulos[ci]
        const tituloId = cap.tituloIdx != null && tituloIdMap[cap.tituloIdx] ? tituloIdMap[cap.tituloIdx] : null
        const capCreated = await tx.capituloPresupuesto.create({
          data: {
            presupuestoId: created.id,
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

      // Create indirecto lineas
      for (let li = 0; li < indirectoLineas.length; li++) {
        const l = indirectoLineas[li]
        await tx.presupuestoIndirectoLinea.create({
          data: {
            presupuestoId: created.id,
            nombre: l.nombre,
            porcentaje: safeNum(l.porcentaje, 100),
            orden: li,
            activo: l.activo !== false,
          },
        })
      }

      return created
    })

    return NextResponse.json({ id: presupuesto.id, numero: presupuesto.numero }, { status: 201 })
  } catch (error) {
    console.error('Error creating presupuesto v2:', error)
    return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 })
  }
}
