import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ClienteSchema, zodError } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const clientes = await prisma.cliente.findMany({
      where: search
        ? {
            OR: [
              { nombre:  { contains: search, mode: 'insensitive' } },
              { correo:  { contains: search, mode: 'insensitive' } },
              { telefono:{ contains: search, mode: 'insensitive' } },
              { rnc:     { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { proyectos: true, presupuestos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(clientes)
  } catch (error) {
    console.error('Error fetching clientes:', error)
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ClienteSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)

    const { nombre, rnc, telefono, whatsapp, correo, direccion, tipoCliente, fuente, notas } = parsed.data

    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        rnc:         rnc     || null,
        telefono:    telefono || null,
        whatsapp:    whatsapp || null,
        correo:      correo   || null,
        direccion:   direccion || null,
        tipoCliente,
        fuente,
        notas:       notas || null,
      },
    })

    return NextResponse.json(cliente, { status: 201 })
  } catch (error) {
    console.error('Error creating cliente:', error)
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
  }
}
