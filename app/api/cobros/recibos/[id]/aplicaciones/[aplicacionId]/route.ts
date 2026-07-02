import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import { recalcularFactura, recalcularRecibo } from '@/lib/recibos'

export const DELETE = apiHandler({ modulo: 'contabilidad', nivel: 'editar' }, async (_req, ctx) => {
  const id = ctx.id
  const aplicacionId = parseInt(ctx.params.aplicacionId ?? '', 10)
  if (isNaN(aplicacionId)) throw new ApiError(400, 'ID inválido')

  // Cargar la aplicación junto con el recibo y el proyecto de la factura.
  const aplicacion = await prisma.aplicacionRecibo.findUnique({
    where: { id: aplicacionId },
    include: {
      recibo: { select: { id: true, estado: true } },
      factura: { select: { id: true, proyectoId: true } },
    },
  })
  if (!aplicacion) throw new ApiError(404, 'Aplicación no encontrada')
  // Defensa: la aplicación debe pertenecer al recibo de la URL.
  if (aplicacion.reciboId !== id) throw new ApiError(400, 'La aplicación no pertenece a este recibo')
  if (aplicacion.recibo.estado === 'anulado') throw new ApiError(400, 'Recibo anulado')

  // Misma guarda que aplicar: no mover dinero en proyecto cerrado.
  const cerrado = await validarProyectoNoCerrado(aplicacion.factura.proyectoId)
  if (cerrado) return cerrado

  await prisma.$transaction(async (tx) => {
    await tx.aplicacionRecibo.delete({ where: { id: aplicacionId } })
    await recalcularFactura(tx, aplicacion.facturaId)
    await recalcularRecibo(tx, id)
  })

  return NextResponse.json({ ok: true })
})
