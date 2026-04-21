import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalcValorOportunidad } from '@/lib/oportunidad-valor'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

// POST: vincular un presupuesto existente a la oportunidad
export const POST = withPermiso('oportunidades', 'editar', async (req: NextRequest, { params }: Ctx) => {
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
})

// DELETE: desvincular un presupuesto de la oportunidad
export const DELETE = withPermiso('oportunidades', 'editar', async (req: NextRequest, { params }: Ctx) => {
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
})
