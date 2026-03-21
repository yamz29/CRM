import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const body = await request.json()
  const { nombre, cargo, telefono, correo, activo } = body

  const vendedor = await prisma.vendedor.update({
    where: { id },
    data: {
      nombre,
      cargo: cargo || null,
      telefono: telefono || null,
      correo: correo || null,
      activo: activo !== undefined ? activo : true,
    },
  })
  return NextResponse.json(vendedor)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  await prisma.vendedor.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
