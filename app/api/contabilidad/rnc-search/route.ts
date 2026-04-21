import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/contabilidad/rnc-search?rnc=<rnc>
// Busca un RNC en 3 niveles (del más específico al más general):
//   1. Cliente del sistema (si el RNC coincide exacto)
//   2. Proveedor del catálogo (si existe)
//   3. Factura previa con ese RNC (nombre que ya se usó)
//   4. Catálogo oficial DGII (fallback — 700k+ contribuyentes)
// Retorna el mejor match encontrado.
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const rncRaw = request.nextUrl.searchParams.get('rnc')
  if (!rncRaw) return NextResponse.json({ error: 'RNC requerido' }, { status: 400 })

  const rnc = rncRaw.replace(/[^\d]/g, '')
  if (rnc.length < 9) {
    return NextResponse.json({ cliente: null, proveedor: null, proveedorPrevio: null, dgii: null })
  }

  try {
    const [cliente, proveedor, facturaPrevia, dgii] = await Promise.all([
      prisma.cliente.findFirst({
        where: { rnc: { contains: rnc, mode: 'insensitive' } },
        select: { id: true, nombre: true, rnc: true },
      }),
      prisma.proveedor.findFirst({
        where: { rnc: { contains: rnc, mode: 'insensitive' }, activo: true },
        select: { id: true, nombre: true, rnc: true, condicionesPago: true },
      }),
      prisma.factura.findFirst({
        where: { rncProveedor: { contains: rnc, mode: 'insensitive' } },
        select: { proveedor: true, rncProveedor: true },
        orderBy: { creadoEn: 'desc' },
      }),
      // Búsqueda DGII solo por PK exacto (rápido). Si el usuario dio 9 dígitos
      // y el DGII guarda 11, intentamos ambos.
      prisma.rncDgii.findFirst({
        where: { rnc: { in: [rnc, rnc.padStart(11, '0')] } },
        select: { rnc: true, nombre: true, nombreComercial: true, estado: true, actividad: true },
      }),
    ])

    return NextResponse.json({
      cliente: cliente || null,
      proveedor: proveedor || null,
      proveedorPrevio: facturaPrevia
        ? { nombre: facturaPrevia.proveedor, rnc: facturaPrevia.rncProveedor }
        : null,
      dgii: dgii || null,
    })
  } catch (error) {
    console.error('Error searching RNC:', error)
    return NextResponse.json({ error: 'Error al buscar RNC' }, { status: 500 })
  }
}
