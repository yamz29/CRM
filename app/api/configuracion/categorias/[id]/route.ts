import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const body = await request.json()
  const { nombre, tipo, color, descripcion } = body

  const categoria = await prisma.categoria.update({
    where: { id },
    data: {
      nombre,
      tipo: tipo || 'Proyecto',
      color: color || '#3b82f6',
      descripcion: descripcion || null,
    },
  })
  return NextResponse.json(categoria)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  await prisma.categoria.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
