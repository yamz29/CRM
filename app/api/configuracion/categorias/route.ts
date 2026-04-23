import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest) => {
  const categorias = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(categorias)
})

export const POST = withPermiso('configuracion', 'editar', async (request: NextRequest) => {
  const body = await request.json()
  const { nombre, tipo, color, descripcion } = body

  const categoria = await prisma.categoria.create({
    data: {
      nombre,
      tipo: tipo || 'Proyecto',
      color: color || '#3b82f6',
      descripcion: descripcion || null,
    },
  })
  return NextResponse.json(categoria)
})
