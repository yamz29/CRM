import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const PUT = withPermiso('configuracion', 'editar', async (request: NextRequest, { params }: Ctx) => {
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
})

export const DELETE = withPermiso('configuracion', 'editar', async (_request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  await prisma.vendedor.delete({ where: { id } })
  return NextResponse.json({ ok: true })
})
