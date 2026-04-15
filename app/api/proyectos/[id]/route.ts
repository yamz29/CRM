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

    const proyecto = await prisma.proyecto.findUnique({
      where: { id },
      include: {
        cliente: true,
        presupuestos: {
          include: {
            _count: { select: { partidas: true, modulosMelamina: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(proyecto)
  } catch (error) {
    console.error('Error fetching proyecto:', error)
    return NextResponse.json(
      { error: 'Error al obtener proyecto' },
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

    // Acción rápida: archivar/desarchivar (no requiere todos los campos)
    if (body._archivar !== undefined) {
      const proyecto = await prisma.proyecto.update({
        where: { id },
        data: {
          archivada: !!body._archivar,
          fechaArchivada: body._archivar ? new Date() : null,
        },
      })
      return NextResponse.json(proyecto)
    }

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
      avanceFisico,
    } = body

    if (!nombre || !clienteId) {
      return NextResponse.json(
        { error: 'Nombre y cliente son requeridos' },
        { status: 400 }
      )
    }

    const proyecto = await prisma.proyecto.update({
      where: { id },
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
        avanceFisico: avanceFisico != null ? parseInt(avanceFisico) : 0,
      },
    })

    return NextResponse.json(proyecto)
  } catch (error) {
    console.error('Error updating proyecto:', error)
    return NextResponse.json(
      { error: 'Error al actualizar proyecto' },
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

    await prisma.proyecto.delete({ where: { id } })

    return NextResponse.json({ message: 'Proyecto eliminado correctamente' })
  } catch (error) {
    console.error('Error deleting proyecto:', error)
    return NextResponse.json(
      { error: 'Error al eliminar proyecto' },
      { status: 500 }
    )
  }
}
