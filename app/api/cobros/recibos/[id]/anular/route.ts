import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { recalcularFactura } from '@/lib/recibos'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied
  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const recibo = await prisma.recibo.findUnique({ where: { id }, include: { aplicaciones: true } })
  if (!recibo) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
  if (recibo.estado === 'anulado') return NextResponse.json({ error: 'Ya está anulado' }, { status: 400 })

  const facturaIds = recibo.aplicaciones.map(a => a.facturaId)
  await prisma.$transaction(async (tx) => {
    await tx.aplicacionRecibo.deleteMany({ where: { reciboId: id } })
    await tx.movimientoBancario.deleteMany({ where: { reciboId: id } })
    await tx.recibo.update({ where: { id }, data: { estado: 'anulado', montoAplicado: 0 } })
    for (const fid of facturaIds) await recalcularFactura(tx, fid)
  })
  return NextResponse.json({ ok: true })
}
