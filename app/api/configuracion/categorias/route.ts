import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const categorias = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(categorias)
}

export async function POST(request: Request) {
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
}
