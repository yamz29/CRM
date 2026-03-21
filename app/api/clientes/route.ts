import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const clientes = await prisma.cliente.findMany({
      where: search
        ? {
            OR: [
              { nombre: { contains: search } },
              { correo: { contains: search } },
              { telefono: { contains: search } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: {
            proyectos: true,
            presupuestos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(clientes)
  } catch (error) {
    console.error('Error fetching clientes:', error)
    return NextResponse.json(
      { error: 'Error al obtener clientes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nombre, telefono, whatsapp, correo, direccion, tipoCliente, fuente, notas } = body

    if (!nombre) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        telefono: telefono || null,
        whatsapp: whatsapp || null,
        correo: correo || null,
        direccion: direccion || null,
        tipoCliente: tipoCliente || 'Particular',
        fuente: fuente || 'Directo',
        notas: notas || null,
      },
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    console.error('Error creating cliente:', error)
    return NextResponse.json(
      { error: 'Error al crear cliente' },
      { status: 500 }
    )
  }
}
