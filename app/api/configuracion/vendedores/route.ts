import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest) => {
  const vendedores = await prisma.vendedor.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(vendedores)
})

export const POST = withPermiso('configuracion', 'editar', async (request: NextRequest) => {
  const body = await request.json()
  const { nombre, cargo, telefono, correo, activo } = body

  const vendedor = await prisma.vendedor.create({
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
