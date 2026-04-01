import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ClienteSchema, zodError } from '@/lib/validations'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        proyectos:    { orderBy: { createdAt: 'desc' } },
        presupuestos: { include: { proyecto: true }, orderBy: { createdAt: 'desc' } },
      },
    })

    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    return NextResponse.json(cliente)
  } catch (error) {
    console.error('Error fetching cliente:', error)
    return NextResponse.json({ error: 'Error al obtener cliente' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json()
    const parsed = ClienteSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)

    const { nombre, rnc, telefono, whatsapp, correo, direccion, tipoCliente, fuente, notas } = parsed.data

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre,
        rnc:         rnc       || null,
        telefono:    telefono  || null,
        whatsapp:    whatsapp  || null,
        correo:      correo    || null,
        direccion:   direccion || null,
        tipoCliente,
        fuente,
        notas:       notas || null,
      },
    })

    return NextResponse.json(cliente)
  } catch (error) {
    console.error('Error updating cliente:', error)
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    await prisma.cliente.delete({ where: { id } })
    return NextResponse.json({ message: 'Cliente eliminado correctamente' })
  } catch (error) {
    console.error('Error deleting cliente:', error)
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 })
  }
}
