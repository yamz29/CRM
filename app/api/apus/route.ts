import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const INCLUDE_RECURSOS = {
  recursos: {
    include: { recurso: true, apuHijo: { select: { id: true, codigo: true, nombre: true, unidad: true, precioVenta: true } } },
    orderBy: { orden: 'asc' as const },
  },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const capitulo = searchParams.get('capitulo')
  const withRecursos = searchParams.get('withRecursos') === 'true'

  try {
    const apus = await prisma.apuCatalogo.findMany({
      where: {
        activo: true,
        ...(q ? { OR: [{ nombre: { contains: q } }, { codigo: { contains: q } }, { capitulo: { contains: q } }] } : {}),
        ...(capitulo ? { capitulo } : {}),
      },
      include: withRecursos ? INCLUDE_RECURSOS : undefined,
      orderBy: [{ capitulo: 'asc' }, { nombre: 'asc' }],
    })
    return NextResponse.json(apus)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener APUs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recursos = [], ...apuData } = body

    const costoDirecto = recursos.reduce((s: number, r: any) => s + (parseFloat(r.subtotal) || 0), 0)
    const costoTotal = costoDirecto * (1 + (parseFloat(apuData.indirectos) || 0) / 100)
    const precioBruto = costoTotal * (1 + (parseFloat(apuData.utilidad) || 0) / 100)
    const volumenAnalisis = apuData.volumenAnalisis != null ? parseFloat(apuData.volumenAnalisis) : null
    const divisor = volumenAnalisis && volumenAnalisis > 0 ? volumenAnalisis : 1
    const precioVenta = precioBruto / divisor

    const apu = await prisma.apuCatalogo.create({
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

    return NextResponse.json(apu, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear APU' }, { status: 500 })
  }
}
