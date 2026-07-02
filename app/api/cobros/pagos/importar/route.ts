import { NextResponse } from 'next/server'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { ImportarRecibosSchema } from '@/lib/api-schemas'
import { prisma } from '@/lib/prisma'
import { siguienteNumeroRecibo, estadoRecibo, recalcularFactura } from '@/lib/recibos'

/**
 * POST /api/cobros/pagos/importar
 * Body: { filas: FilaImportableRecibo[] }  (solo filas válidas; el cliente omite las de error)
 *
 * Registra todos los cobros en UNA transacción:
 *   - crea un Recibo + AplicacionRecibo por cada fila
 *   - numeración REC-YYYY-NNNN con contador por año (cargado una vez del máximo existente)
 *   - recalcula montoPagado/estado de cada factura afectada
 *   - crea el MovimientoBancario conciliado (con reciboId) por cada fila con cuenta bancaria
 * Si algo falla, revierte todo.
 */
export const POST = apiHandler(
  { modulo: 'contabilidad', nivel: 'editar', schema: ImportarRecibosSchema },
  async (_req, ctx) => {
    const filas = ctx.body.filas

    // Precalcular numeración por año (fuera de la transacción, un MAX por año)
    // para no encadenar consultas en serie dentro de la tx.
    const aniosNecesarios = new Set(filas.map(f => new Date(f.fecha).getFullYear()))
    const contadorAnio = new Map<number, number>()
    for (const anio of aniosNecesarios) {
      const ultimo = await prisma.recibo.findFirst({
        where: { numero: { startsWith: `REC-${anio}-` } },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      })
      const n = ultimo ? parseInt(ultimo.numero.match(/REC-\d{4}-(\d+)/)?.[1] ?? '0', 10) : 0
      contadorAnio.set(anio, n)
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const ids = [...new Set(filas.map(f => f.facturaId))]
        const facturas = await tx.factura.findMany({ where: { id: { in: ids }, tipo: 'ingreso' } })
        const facturaMap = new Map(facturas.map(f => [f.id, f]))

        let recibosCreados = 0
        const afectadas = new Set<number>()

        for (const f of filas) {
          const factura = facturaMap.get(f.facturaId)
          if (!factura) throw new Error(`Factura ${f.facturaId} no encontrada (tipo ingreso)`)
          if (factura.estado === 'anulada') throw new Error(`Factura ${factura.numero} está anulada`)

          const fechaRecibo = new Date(f.fecha)
          const anio = fechaRecibo.getFullYear()

          // Generar número con contador local (evita colisiones dentro del lote)
          const n = contadorAnio.get(anio) ?? 0
          const numero = siguienteNumeroRecibo(n > 0 ? `REC-${anio}-${String(n).padStart(4, '0')}` : null, anio)
          contadorAnio.set(anio, n + 1)

          const recibo = await tx.recibo.create({
            data: {
              numero,
              clienteId: f.clienteId,
              fecha: fechaRecibo,
              monto: f.monto,
              metodoPago: f.metodoPago || 'Transferencia',
              cuentaBancariaId: f.cuentaBancariaId ?? null,
              referencia: f.referencia || null,
              observaciones: f.observaciones || null,
              montoAplicado: f.monto,
              estado: estadoRecibo(f.monto, f.monto),
            },
          })

          await tx.aplicacionRecibo.create({
            data: { reciboId: recibo.id, facturaId: f.facturaId, monto: f.monto },
          })

          recibosCreados++
          afectadas.add(f.facturaId)

          if (f.cuentaBancariaId) {
            await tx.movimientoBancario.create({
              data: {
                cuentaBancariaId: f.cuentaBancariaId,
                fecha: fechaRecibo,
                tipo: 'credito',
                monto: f.monto,
                descripcion: `Recibo ${numero}`,
                referencia: f.referencia || null,
                conciliado: true,
                reciboId: recibo.id,
              },
            })
          }
        }

        // Recalcular montoPagado/estado una vez por factura afectada
        for (const facturaId of afectadas) {
          await recalcularFactura(tx, facturaId)
        }

        return { recibosCreados, facturasActualizadas: afectadas.size }
      })

      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      // Mantener el mensaje de dominio (ej. "Factura X está anulada") y dejar
      // claro que la transacción se revirtió completa.
      console.error('[importar recibos]', error)
      const msg = error instanceof Error ? error.message : 'Error al importar cobros'
      throw new ApiError(500, `${msg}. Ningún cobro fue registrado (transacción revertida).`)
    }
  },
)
