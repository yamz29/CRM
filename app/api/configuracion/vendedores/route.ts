import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const vendedores = await prisma.vendedor.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(vendedores)
}

export async function POST(request: Request) {
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
}
