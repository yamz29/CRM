import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import { recalcularFactura, recalcularRecibo } from '@/lib/recibos'

type Ctx = { params: Promise<{ id: string; aplicacionId: string }> }

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const { id: idStr, aplicacionId: aplStr } = await params
  const id = parseInt(idStr)
  const aplicacionId = parseInt(aplStr)
  if (isNaN(id) || isNaN(aplicacionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Cargar la aplicación junto con el recibo y el proyecto de la factura.
  const aplicacion = await prisma.aplicacionRecibo.findUnique({
    where: { id: aplicacionId },
    include: {
      recibo: { select: { id: true, estado: true } },
      factura: { select: { id: true, proyectoId: true } },
    },
  })
  if (!aplicacion) {
    return NextResponse.json({ error: 'Aplicación no encontrada' }, { status: 404 })
  }
  // Defensa: la aplicación debe pertenecer al recibo de la URL.
  if (aplicacion.reciboId !== id) {
    return NextResponse.json({ error: 'La aplicación no pertenece a este recibo' }, { status: 400 })
  }
  if (aplicacion.recibo.estado === 'anulado') {
    return NextResponse.json({ error: 'Recibo anulado' }, { status: 400 })
  }

  // Misma guarda que aplicar: no mover dinero en proyecto cerrado.
  const cerrado = await validarProyectoNoCerrado(aplicacion.factura.proyectoId)
  if (cerrado) return cerrado

  await prisma.$transaction(async (tx) => {
    await tx.aplicacionRecibo.delete({ where: { id: aplicacionId } })
    await recalcularFactura(tx, aplicacion.facturaId)
    await recalcularRecibo(tx, id)
  })

  return NextResponse.json({ ok: true })
}
