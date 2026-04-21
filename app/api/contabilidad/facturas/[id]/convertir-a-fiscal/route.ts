import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// POST /api/contabilidad/facturas/[id]/convertir-a-fiscal
// Convierte una factura proforma en factura fiscal al agregarle el NCF.
// Mantiene el mismo número PRO-YYYY-NNNN (para trazabilidad) y pasa
// esProforma = false. Los pagos ya registrados se conservan.
//
// Body: { ncf: string, fecha?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const ncf = body.ncf?.toString().trim()

    if (!ncf) {
      return NextResponse.json({ error: 'NCF requerido' }, { status: 400 })
    }

    // Validación básica de formato NCF dominicano
    if (!/^[BE]\d{10,12}$/.test(ncf)) {
      return NextResponse.json(
        { error: 'NCF inválido. Formato esperado: B01XXXXXXXXXX o E31XXXXXXXXXX' },
        { status: 400 }
      )
    }

    const factura = await prisma.factura.findUnique({ where: { id } })
    if (!factura) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }
    if (!factura.esProforma) {
      return NextResponse.json(
        { error: 'Esta factura ya es fiscal (tiene NCF o no es proforma)' },
        { status: 400 }
      )
    }

    // Verificar que el NCF no esté ya en uso por otra factura
    const duplicado = await prisma.factura.findFirst({
      where: { ncf, id: { not: id } },
      select: { id: true, numero: true },
    })
    if (duplicado) {
      return NextResponse.json(
        { error: `Este NCF ya está asignado a la factura ${duplicado.numero}` },
        { status: 400 }
      )
    }

    const actualizada = await prisma.factura.update({
      where: { id },
      data: {
        ncf,
        esProforma: false,
        ...(body.fecha ? { fecha: new Date(body.fecha) } : {}),
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(actualizada)
  } catch (error) {
    console.error('Error convertir a fiscal:', error)
    const msg = error instanceof Error ? error.message : 'Error al convertir'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
