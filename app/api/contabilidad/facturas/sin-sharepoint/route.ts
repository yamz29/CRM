import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// Lista las facturas que tienen archivo local (archivoUrl) pero aún no se
// subieron a SharePoint (sharepointUrl null). Alimenta la herramienta de
// re-sincronización en lote (/contabilidad/facturas/resync-sharepoint).
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const facturas = await prisma.factura.findMany({
      where: {
        archivoUrl: { not: null },
        sharepointUrl: null,
      },
      select: {
        id: true,
        numero: true,
        proveedor: true,
        fecha: true,
        archivoUrl: true,
      },
      orderBy: { fecha: 'asc' },
    })

    return NextResponse.json({ total: facturas.length, facturas })
  } catch (error) {
    console.error('Error listando facturas sin SharePoint:', error)
    return NextResponse.json(
      { error: 'No se pudieron listar las facturas pendientes' },
      { status: 500 }
    )
  }
}
