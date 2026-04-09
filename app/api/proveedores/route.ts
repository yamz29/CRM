import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/proveedores — lista de proveedores
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const q = request.nextUrl.searchParams.get('q') || ''
  const activos = request.nextUrl.searchParams.get('activos') !== 'false'

  const where: Record<string, unknown> = {}
  if (activos) where.activo = true
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { rnc: { contains: q, mode: 'insensitive' } },
      { contacto: { contains: q, mode: 'insensitive' } },
    ]
  }

  const proveedores = await prisma.proveedor.findMany({
    where,
    orderBy: { nombre: 'asc' },
    include: {
      _count: { select: { facturas: true } },
    },
  })

  return NextResponse.json(proveedores)
}

// POST /api/proveedores — crear proveedor
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()
    const nombre = body.nombre?.toString().trim()
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const rnc = body.rnc?.toString().trim() || null
    if (rnc) {
      const existe = await prisma.proveedor.findUnique({ where: { rnc } })
      if (existe) {
        return NextResponse.json({ error: `Ya existe un proveedor con RNC ${rnc}: ${existe.nombre}` }, { status: 409 })
      }
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        nombre,
        rnc,
        telefono: body.telefono?.toString().trim() || null,
        contacto: body.contacto?.toString().trim() || null,
        correo: body.correo?.toString().trim() || null,
        direccion: body.direccion?.toString().trim() || null,
        condicionesPago: body.condicionesPago?.toString().trim() || null,
        notas: body.notas?.toString().trim() || null,
      },
    })

    return NextResponse.json(proveedor)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear proveedor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
