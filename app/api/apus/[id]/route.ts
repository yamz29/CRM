import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ── Cycle detection ────────────────────────────────────────────────────────────
// Returns true if `targetId` appears anywhere in the composition tree of `rootId`
async function wouldCreateCycle(rootId: number, targetId: number): Promise<boolean> {
  if (rootId === targetId) return true
  const visited = new Set<number>()
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const children = await prisma.apuRecurso.findMany({
      where: { apuId: current, tipoComponente: 'apu', apuHijoId: { not: null } },
      select: { apuHijoId: true },
    })
    for (const c of children) {
      if (c.apuHijoId === targetId) return true
      if (c.apuHijoId) queue.push(c.apuHijoId)
    }
  }
  return false
}

const INCLUDE_RECURSOS = {
  recursos: {
    include: { recurso: true, apuHijo: { select: { id: true, codigo: true, nombre: true, unidad: true, precioVenta: true } } },
    orderBy: { orden: 'asc' as const },
  },
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    const apu = await prisma.apuCatalogo.findUnique({ where: { id }, include: INCLUDE_RECURSOS })
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

    // Validate APU components — detect cycles
    for (const r of recursos) {
      if (r.tipoComponente === 'apu' && r.apuHijoId) {
        const hijoId = parseInt(String(r.apuHijoId))
        if (hijoId === id) {
          return NextResponse.json({ error: 'Un APU no puede contenerse a sí mismo.' }, { status: 400 })
        }
        // Check if adding hijoId would create a cycle (hijoId already contains id in its tree)
        const cycle = await wouldCreateCycle(hijoId, id)
        if (cycle) {
          return NextResponse.json(
            { error: `Ciclo detectado: el APU seleccionado ya contiene este APU en su composición.` },
            { status: 400 }
          )
        }
      }
    }

    const costoDirecto = recursos.reduce((s: number, r: any) => s + (parseFloat(r.subtotal) || 0), 0)
    const costoTotal = costoDirecto * (1 + (parseFloat(apuData.indirectos) || 0) / 100)
    const precioBruto = costoTotal * (1 + (parseFloat(apuData.utilidad) || 0) / 100)
    const volumenAnalisis = apuData.volumenAnalisis != null ? parseFloat(apuData.volumenAnalisis) : null
    const divisor = volumenAnalisis && volumenAnalisis > 0 ? volumenAnalisis : 1
    const precioVenta = precioBruto / divisor

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
        rendimiento: apuData.rendimiento != null ? parseFloat(apuData.rendimiento) : null,
        volumenAnalisis,
        costoDirecto,
        costoTotal,
        precioVenta,
        activo: apuData.activo !== false,
        observaciones: apuData.observaciones || null,
        recursos: {
          create: recursos.map((r: any, i: number) => ({
            tipoComponente: r.tipoComponente || 'recurso',
            recursoId: r.recursoId ? parseInt(String(r.recursoId)) : null,
            apuHijoId: r.apuHijoId ? parseInt(String(r.apuHijoId)) : null,
            nombreSnapshot: r.nombreSnapshot || null,
            unidadSnapshot: r.unidadSnapshot || null,
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
      include: INCLUDE_RECURSOS,
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
