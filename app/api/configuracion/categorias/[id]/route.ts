import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withPermiso('configuracion', 'editar', async (request: NextRequest, { params }: Ctx) => {
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
})

export const DELETE = withPermiso('configuracion', 'editar', async (_request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  await prisma.categoria.delete({ where: { id } })
  return NextResponse.json({ ok: true })
})
