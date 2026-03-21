import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        cliente: true,
        proyecto: true,
        partidas: { orderBy: { orden: 'asc' } },
        modulosMelamina: { orderBy: { orden: 'asc' } },
      },
    })

    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error('Error fetching presupuesto:', error)
    return NextResponse.json(
      { error: 'Error al obtener presupuesto' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { clienteId, proyectoId, estado, notas, partidas, modulosMelamina } = body

    if (!clienteId) {
      return NextResponse.json(
        { error: 'El cliente es requerido' },
        { status: 400 }
      )
    }

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

    // Delete existing partidas and modules
    await prisma.partida.deleteMany({ where: { presupuestoId: id } })
    await prisma.moduloMelamina.deleteMany({ where: { presupuestoId: id } })

    // Update presupuesto
    const presupuesto = await prisma.presupuesto.update({
      where: { id },
      data: {
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
    })

    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error('Error updating presupuesto:', error)
    return NextResponse.json(
      { error: 'Error al actualizar presupuesto' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    await prisma.presupuesto.delete({ where: { id } })

    return NextResponse.json({ message: 'Presupuesto eliminado correctamente' })
  } catch (error) {
    console.error('Error deleting presupuesto:', error)
    return NextResponse.json(
      { error: 'Error al eliminar presupuesto' },
      { status: 500 }
    )
  }
}
