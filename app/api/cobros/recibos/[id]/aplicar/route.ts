import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'
import { validarAplicaciones, recalcularFactura, recalcularRecibo, type AplicacionInput, type FacturaSaldo } from '@/lib/recibos'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied
  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const recibo = await prisma.recibo.findUnique({ where: { id }, include: { aplicaciones: true } })
  if (!recibo) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
  if (recibo.estado === 'anulado') return NextResponse.json({ error: 'Recibo anulado' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const nuevas: AplicacionInput[] = Array.isArray(body?.aplicaciones)
    ? body.aplicaciones.map((a: { facturaId: number; monto: number }) => ({ facturaId: Number(a.facturaId), monto: Number(a.monto) }))
    : []
  if (nuevas.length === 0) return NextResponse.json({ error: 'No hay aplicaciones' }, { status: 400 })

  const disponible = recibo.monto - recibo.montoAplicado
  const facturas = await prisma.factura.findMany({
    where: { id: { in: nuevas.map(a => a.facturaId) }, tipo: 'ingreso' },
    select: { id: true, total: true, montoPagado: true, estado: true, proyectoId: true },
  })
  const map = new Map<number, FacturaSaldo>(facturas.map(f => [f.id, f]))
  const errores = validarAplicaciones(disponible, nuevas, map)
  if (errores.length) return NextResponse.json({ error: errores.join(' · ') }, { status: 400 })
  for (const f of facturas) {
    const cerrado = await validarProyectoNoCerrado(f.proyectoId)
    if (cerrado) return cerrado
  }

  await prisma.$transaction(async (tx) => {
    for (const a of nuevas) {
      const existente = await tx.aplicacionRecibo.findUnique({
        where: { reciboId_facturaId: { reciboId: id, facturaId: a.facturaId } },
      })
      if (existente) {
        await tx.aplicacionRecibo.update({ where: { id: existente.id }, data: { monto: existente.monto + a.monto } })
      } else {
        await tx.aplicacionRecibo.create({ data: { reciboId: id, facturaId: a.facturaId, monto: a.monto } })
      }
      await recalcularFactura(tx, a.facturaId)
    }
    await recalcularRecibo(tx, id)
  })

  return NextResponse.json({ ok: true })
}
