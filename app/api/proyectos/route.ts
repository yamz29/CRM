import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const clienteId = searchParams.get('clienteId')

    const proyectos = await prisma.proyecto.findMany({
      where: {
        ...(estado ? { estado } : {}),
        ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
      },
      include: {
        cliente: {
          select: { id: true, nombre: true },
        },
        _count: {
          select: { presupuestos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(proyectos)
  } catch (error) {
    console.error('Error fetching proyectos:', error)
    return NextResponse.json(
      { error: 'Error al obtener proyectos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nombre,
      clienteId,
      tipoProyecto,
      ubicacion,
      fechaInicio,
      fechaEstimada,
      estado,
      descripcion,
      responsable,
      presupuestoEstimado,
    } = body

    if (!nombre || !clienteId) {
      return NextResponse.json(
        { error: 'Nombre y cliente son requeridos' },
        { status: 400 }
      )
    }

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre,
        clienteId: parseInt(clienteId),
        tipoProyecto: tipoProyecto || 'Remodelación',
        ubicacion: ubicacion || null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaEstimada: fechaEstimada ? new Date(fechaEstimada) : null,
        estado: estado || 'Prospecto',
        descripcion: descripcion || null,
        responsable: responsable || null,
        presupuestoEstimado: presupuestoEstimado ? parseFloat(presupuestoEstimado) : null,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(proyecto, { status: 201 })
  } catch (error) {
    console.error('Error creating proyecto:', error)
    return NextResponse.json(
      { error: 'Error al crear proyecto' },
      { status: 500 }
    )
  }
}
