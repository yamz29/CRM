import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const rnc = request.nextUrl.searchParams.get('rnc')
  if (!rnc) return NextResponse.json({ error: 'RNC requerido' }, { status: 400 })

  try {
    // Search in clientes by RNC
    const cliente = await prisma.cliente.findFirst({
      where: { rnc: { contains: rnc, mode: 'insensitive' } },
      select: { id: true, nombre: true, rnc: true },
    })

    // Also search in existing facturas for same RNC
    const facturaPrevia = await prisma.factura.findFirst({
      where: { rncProveedor: { contains: rnc, mode: 'insensitive' } },
      select: { proveedor: true, rncProveedor: true },
      orderBy: { creadoEn: 'desc' },
    })

    return NextResponse.json({
      cliente: cliente || null,
      proveedorPrevio: facturaPrevia ? { nombre: facturaPrevia.proveedor, rnc: facturaPrevia.rncProveedor } : null,
    })
  } catch (error) {
    console.error('Error searching RNC:', error)
    return NextResponse.json({ error: 'Error al buscar RNC' }, { status: 500 })
  }
}
