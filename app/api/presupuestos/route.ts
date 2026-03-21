import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')
    const proyectoId = searchParams.get('proyectoId')

    const presupuestos = await prisma.presupuesto.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
        ...(proyectoId ? { proyectoId: parseInt(proyectoId) } : {}),
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        _count: {
          select: { partidas: true, modulosMelamina: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(presupuestos)
  } catch (error) {
    console.error('Error fetching presupuestos:', error)
    return NextResponse.json(
      { error: 'Error al obtener presupuestos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clienteId, proyectoId, estado, notas, partidas, modulosMelamina } = body

    if (!clienteId) {
      return NextResponse.json(
        { error: 'El cliente es requerido' },
        { status: 400 }
      )
    }

    // Generate budget number
    const count = await prisma.presupuesto.count()
    const numero = `COT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    // Calculate totals
    let subtotalPartidas = 0
    let subtotalModulos = 0

    if (partidas && Array.isArray(partidas)) {
      subtotalPartidas = partidas.reduce((acc: number, p: { cantidad: number; precioUnitario: number }) => {
        return acc + (parseFloat(String(p.cantidad)) || 0) * (parseFloat(String(p.precioUnitario)) || 0)
      }, 0)
    }

    if (modulosMelamina && Array.isArray(modulosMelamina)) {
      subtotalModulos = modulosMelamina.reduce((acc: number, m: { subtotal: number; cantidad: number }) => {
        return acc + (parseFloat(String(m.subtotal)) || 0) * (parseInt(String(m.cantidad)) || 1)
      }, 0)
    }

    const total = subtotalPartidas + subtotalModulos

    const presupuesto = await prisma.presupuesto.create({
      data: {
        numero,
        clienteId: parseInt(clienteId),
        proyectoId: proyectoId ? parseInt(proyectoId) : null,
        estado: estado || 'Borrador',
        notas: notas || null,
        subtotal: total,
        total,
        partidas: partidas && partidas.length > 0
          ? {
              create: partidas.map((p: {
                descripcion: string
                unidad: string
                cantidad: number
                precioUnitario: number
                orden: number
              }, index: number) => ({
                descripcion: p.descripcion,
                unidad: p.unidad || 'm2',
                cantidad: parseFloat(String(p.cantidad)) || 1,
                precioUnitario: parseFloat(String(p.precioUnitario)) || 0,
                subtotal: (parseFloat(String(p.cantidad)) || 1) * (parseFloat(String(p.precioUnitario)) || 0),
                orden: p.orden || index,
              })),
            }
          : undefined,
        modulosMelamina: modulosMelamina && modulosMelamina.length > 0
          ? {
              create: modulosMelamina.map((m: {
                tipoModulo: string
                descripcion: string
                ancho: number
                alto: number
                profundidad: number
                material: string
                costoMaterial: number
                costoManoObra: number
                cantidad: number
                orden: number
              }, index: number) => ({
                tipoModulo: m.tipoModulo || 'Base',
                descripcion: m.descripcion,
                ancho: parseFloat(String(m.ancho)) || 0,
                alto: parseFloat(String(m.alto)) || 0,
                profundidad: parseFloat(String(m.profundidad)) || 0,
                material: m.material || 'Melamina 18mm',
                costoMaterial: parseFloat(String(m.costoMaterial)) || 0,
                costoManoObra: parseFloat(String(m.costoManoObra)) || 0,
                subtotal:
                  (parseFloat(String(m.costoMaterial)) || 0) +
                  (parseFloat(String(m.costoManoObra)) || 0),
                cantidad: parseInt(String(m.cantidad)) || 1,
                orden: m.orden || index,
              })),
            }
          : undefined,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(presupuesto, { status: 201 })
  } catch (error) {
    console.error('Error creating presupuesto:', error)
    return NextResponse.json(
      { error: 'Error al crear presupuesto' },
      { status: 500 }
    )
  }
}
