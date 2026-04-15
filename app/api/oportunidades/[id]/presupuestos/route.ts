import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalcValorOportunidad } from '@/lib/oportunidad-valor'

// POST: vincular un presupuesto existente a la oportunidad
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { presupuestoId } = await req.json()
  if (!presupuestoId) return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })

  await prisma.presupuesto.update({
    where: { id: parseInt(presupuestoId) },
    data: { oportunidadId: numId },
  })

  await recalcValorOportunidad(numId)

  return NextResponse.json({ ok: true })
}

// DELETE: desvincular un presupuesto de la oportunidad
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { presupuestoId } = await req.json()
  if (!presupuestoId) return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })

  await prisma.presupuesto.update({
    where: { id: parseInt(presupuestoId) },
    data: { oportunidadId: null },
  })

  await recalcValorOportunidad(numId)

  return NextResponse.json({ ok: true })
}
