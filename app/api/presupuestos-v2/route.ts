import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── helpers ───────────────────────────────────────────────────────────────────

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
    const { clienteId, proyectoId, estado, notas, capitulos = [], titulos = [], indirectoLineas = [] } = body

    if (!clienteId) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })

    const year = new Date().getFullYear()
    const existing = await prisma.presupuesto.findMany({
      where: { numero: { startsWith: `COT-${year}-` } },
      select: { numero: true },
    })
    const usedSeqs = existing.map(p => parseInt(p.numero.split('-')[2] ?? '0')).filter(n => !isNaN(n))
    const maxSeq = usedSeqs.length > 0 ? Math.max(...usedSeqs) : 0
    const numero = `COT-${year}-${String(maxSeq + 1).padStart(3, '0')}`

    const { subtotalBase, total } = calcTotals(capitulos, indirectoLineas)

    // Create presupuesto
    const presupuesto = await prisma.presupuesto.create({
      data: {
        numero,
        clienteId: parseInt(String(clienteId)),
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        estado: estado || 'Borrador',
        notas: notas || null,
        subtotal: subtotalBase,
        total,
      },
    })

    // Create titulos and keep id map
    const tituloIdMap: Record<number, number> = {}
    for (let ti = 0; ti < titulos.length; ti++) {
      const t = titulos[ti]
      const created = await prisma.presupuestoTitulo.create({
        data: { presupuestoId: presupuesto.id, nombre: t.nombre, orden: ti, observaciones: t.observaciones || null },
      })
      tituloIdMap[ti] = created.id
    }

    // Create capitulos with tituloId
    for (let ci = 0; ci < capitulos.length; ci++) {
      const cap = capitulos[ci]
      const tituloId = cap.tituloIdx != null && tituloIdMap[cap.tituloIdx] ? tituloIdMap[cap.tituloIdx] : null
      const created = await prisma.capituloPresupuesto.create({
        data: {
          presupuestoId: presupuesto.id,
          tituloId,
          codigo: cap.codigo || null,
          nombre: cap.nombre,
          orden: ci,
        },
      })
      // Create partidas
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
          presupuestoId: presupuesto.id,
          nombre: l.nombre,
          porcentaje: parseFloat(String(l.porcentaje)) || 0,
          orden: li,
          activo: l.activo !== false,
        },
      })
    }

    return NextResponse.json({ id: presupuesto.id, numero: presupuesto.numero }, { status: 201 })
  } catch (error) {
    console.error('Error creating presupuesto v2:', error)
    return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 })
  }
}
