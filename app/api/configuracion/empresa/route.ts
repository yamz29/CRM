import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const empresa = await prisma.empresa.findFirst()
  return NextResponse.json(empresa)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { nombre, rut, slogan, direccion, telefono, correo, sitioWeb, logoUrl } = body

  const existing = await prisma.empresa.findFirst()

  if (existing) {
    const empresa = await prisma.empresa.update({
      where: { id: existing.id },
      data: { nombre, rut, slogan, direccion, telefono, correo, sitioWeb, logoUrl },
    })
    return NextResponse.json(empresa)
  } else {
    const empresa = await prisma.empresa.create({
      data: { nombre, rut, slogan, direccion, telefono, correo, sitioWeb, logoUrl },
    })
    return NextResponse.json(empresa)
  }
}
