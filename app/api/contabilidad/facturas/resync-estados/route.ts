import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { recalcularEstadoFactura } from '@/lib/factura-estado'

/**
 * POST /api/contabilidad/facturas/resync-estados
 *
 * Recorre todas las facturas no anuladas y recalcula montoPagado + estado
 * contra la suma real de pagos. Útil para limpiar drift histórico.
 *
 * Devuelve un resumen: cuántas se revisaron, cuántas se corrigieron, y
 * la lista de las que cambiaron (numero, antes, después).
 *
 * Solo Admin (escribe a contabilidad → 'editar' es lo más restrictivo
 * que tenemos sin agregar rol específico).
 */
export const POST = withPermiso('contabilidad', 'editar', async (_req: NextRequest) => {
  const facturas = await prisma.factura.findMany({
    where: { estado: { not: 'anulada' } },
    select: { id: true, numero: true, montoPagado: true, estado: true, total: true },
  })

  type Cambio = {
    id: number
    numero: string
    antes: { montoPagado: number; estado: string }
    despues: { montoPagado: number; estado: string }
  }
  const cambios: Cambio[] = []

  for (const f of facturas) {
    const resultado = await recalcularEstadoFactura(f.id)
    if (!resultado) continue

    const cambioMonto = Math.abs(resultado.montoPagado - f.montoPagado) > 0.01
    const cambioEstado = resultado.estado !== f.estado
    if (cambioMonto || cambioEstado) {
      cambios.push({
        id: f.id,
        numero: f.numero,
        antes: { montoPagado: f.montoPagado, estado: f.estado },
        despues: { montoPagado: resultado.montoPagado, estado: resultado.estado },
      })
    }
  }

  console.log(`[resync-estados] ${facturas.length} facturas revisadas, ${cambios.length} corregidas`)

  return NextResponse.json({
    revisadas: facturas.length,
    corregidas: cambios.length,
    cambios,
  })
})
