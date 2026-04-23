import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest) => {
  const empresa = await prisma.empresa.findFirst()
  return NextResponse.json(empresa)
})

export const POST = withPermiso('configuracion', 'editar', async (request: NextRequest) => {
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
})
