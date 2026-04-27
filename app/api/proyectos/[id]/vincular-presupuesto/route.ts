import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/proyectos/[id]/vincular-presupuesto
 * Body: { presupuestoId: number }
 *
 * Asocia un presupuesto existente a este proyecto seteando su `proyectoId`.
 * Valida que ambos pertenezcan al mismo cliente para evitar mezclas.
 */
export const POST = withPermiso('proyectos', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const presupuestoId = parseInt(String(body.presupuestoId))
  if (isNaN(presupuestoId)) {
    return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true, clienteId: true },
  })
  if (!proyecto) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    select: { id: true, clienteId: true, proyectoId: true, numero: true },
  })
  if (!presupuesto) {
    return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
  }

  if (presupuesto.clienteId !== proyecto.clienteId) {
    return NextResponse.json(
      { error: 'El presupuesto pertenece a un cliente distinto. No se puede vincular.' },
      { status: 422 }
    )
  }

  if (presupuesto.proyectoId === proyectoId) {
    return NextResponse.json(
      { error: 'El presupuesto ya está vinculado a este proyecto.' },
      { status: 409 }
    )
  }

  // Si tenía otro proyecto, lo dejamos quedar grabado (audit informal en logs).
  // El frontend ya advirtió al usuario antes de llamar este endpoint.
  if (presupuesto.proyectoId != null) {
    console.warn(
      `[vincular-presupuesto] presupuesto ${presupuesto.numero} (id=${presupuesto.id}) ` +
      `cambia de proyecto ${presupuesto.proyectoId} → ${proyectoId}`
    )
  }

  const actualizado = await prisma.presupuesto.update({
    where: { id: presupuestoId },
    data: { proyectoId },
    select: { id: true, numero: true, proyectoId: true },
  })

  return NextResponse.json({ ok: true, presupuesto: actualizado })
})
