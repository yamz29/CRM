import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { prisma } from '@/lib/prisma'

interface FilaImportable {
  fecha: string
  descripcion: string
  monto: number
  proveedor: string | null
  categoria: string | null
  subcategoria: string | null
  metodoPago: string
  referencia: string | null
  proyectoId: number | null
  destinoTipo: string
  observaciones: string | null
}

/**
 * POST /api/gastos/importar
 * Body: { filas: FilaImportable[] }
 *
 * Crea los gastos en lote dentro de una transacción. El cliente debe haber
 * llamado primero al endpoint /preview para validar — este endpoint asume
 * que las filas vienen ya validadas, pero hace sanity checks mínimos por
 * seguridad (descripcion no vacía, monto >= 0).
 *
 * Si una fila falla, toda la transacción se revierte para no dejar el
 * sistema en un estado inconsistente.
 */
export const POST = withPermiso('gastos', 'editar', async (req: NextRequest) => {
  const userId = req.headers.get('x-user-id')
  const createdBy = userId ? parseInt(userId) : null

  const body = await req.json().catch(() => null)
  const filas: FilaImportable[] = body?.filas ?? []

  if (!Array.isArray(filas) || filas.length === 0) {
    return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
  }
  if (filas.length > 500) {
    return NextResponse.json({ error: 'Demasiadas filas (máx 500 por importación)' }, { status: 400 })
  }

  // Sanity check: rechazar el lote completo si hay alguna fila inválida
  for (const f of filas) {
    if (!f.descripcion?.trim()) {
      return NextResponse.json({ error: 'Una fila no tiene descripción' }, { status: 400 })
    }
    if (typeof f.monto !== 'number' || f.monto < 0 || isNaN(f.monto)) {
      return NextResponse.json({ error: `Monto inválido en fila "${f.descripcion}"` }, { status: 400 })
    }
    if (!f.fecha) {
      return NextResponse.json({ error: `Fecha vacía en fila "${f.descripcion}"` }, { status: 400 })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const creados = []
      for (const f of filas) {
        const gasto = await tx.gastoProyecto.create({
          data: {
            proyectoId: f.proyectoId,
            destinoTipo: f.destinoTipo,
            fecha: new Date(f.fecha),
            tipoGasto: 'Importado',
            descripcion: f.descripcion.trim(),
            suplidor: f.proveedor,
            categoria: f.categoria,
            subcategoria: f.subcategoria,
            monto: f.monto,
            moneda: 'RD$',
            metodoPago: f.metodoPago,
            referencia: f.referencia,
            observaciones: f.observaciones,
            estado: 'Registrado',
            createdBy,
          },
        })
        creados.push(gasto.id)
      }
      return creados
    })

    return NextResponse.json({
      ok: true,
      creados: result.length,
      ids: result,
    })
  } catch (error) {
    console.error('[importar gastos]', error)
    return NextResponse.json(
      { error: 'Error al crear gastos. Ningún registro fue creado (transacción revertida).' },
      { status: 500 }
    )
  }
})
