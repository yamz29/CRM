import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// POST /api/contabilidad/cuentas/[id]/movimientos/bulk-delete
// Body: { ids: number[] }
// Elimina múltiples movimientos bancarios de una cuenta específica.
// Solo borra los que pertenecen a esa cuenta (seguridad — evita que alguien
// pase IDs de otras cuentas en el body).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const { id: idStr } = await params
  const cuentaId = parseInt(idStr)
  if (isNaN(cuentaId)) {
    return NextResponse.json({ error: 'ID de cuenta inválido' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0) : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron IDs' }, { status: 400 })
    }

    const result = await prisma.movimientoBancario.deleteMany({
      where: {
        id: { in: ids },
        cuentaBancariaId: cuentaId,
      },
    })

    return NextResponse.json({
      eliminados: result.count,
      solicitados: ids.length,
    })
  } catch (error) {
    console.error('Error bulk delete movimientos:', error)
    const msg = error instanceof Error ? error.message : 'Error al eliminar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
