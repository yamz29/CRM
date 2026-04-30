import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/proyectos/[id]/vincular-presupuesto
 * Body: { presupuestoId: number, forzarClienteDistinto?: boolean,
 *         actualizarClientePresupuesto?: boolean }
 *
 * Asocia un presupuesto existente a este proyecto seteando su `proyectoId`.
 * Por defecto valida que ambos pertenezcan al mismo cliente. Si el cliente
 * no coincide, devuelve 422 con info; el frontend pide confirmación y
 * reintenta con `forzarClienteDistinto: true`. Si además se manda
 * `actualizarClientePresupuesto: true`, el clienteId del presupuesto se
 * sincroniza con el del proyecto (útil cuando el presupuesto fue creado
 * con cliente null o un id distinto por error histórico).
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
  const forzarClienteDistinto = body.forzarClienteDistinto === true
  const actualizarClientePresupuesto = body.actualizarClientePresupuesto === true

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true, clienteId: true, cliente: { select: { nombre: true } } },
  })
  if (!proyecto) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    select: {
      id: true, clienteId: true, proyectoId: true, numero: true,
      cliente: { select: { nombre: true } },
    },
  })
  if (!presupuesto) {
    return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
  }

  if (presupuesto.clienteId !== proyecto.clienteId && !forzarClienteDistinto) {
    return NextResponse.json(
      {
        error: 'El presupuesto pertenece a un cliente distinto.',
        detalle: `Presupuesto: "${presupuesto.cliente?.nombre ?? 'sin cliente'}" · Proyecto: "${proyecto.cliente?.nombre ?? '?'}". Confirma desde el modal si quieres vincular igualmente.`,
        clienteMismatch: true,
        clientePresupuesto: presupuesto.cliente?.nombre ?? null,
        clienteProyecto: proyecto.cliente?.nombre ?? null,
      },
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

  // Si el usuario confirmó forzar y pidió sincronizar el cliente del
  // presupuesto al del proyecto, lo hacemos. Útil para limpiar datos
  // históricos donde el presupuesto se creó con cliente null o erróneo.
  const dataUpdate: { proyectoId: number; clienteId?: number } = { proyectoId }
  if (forzarClienteDistinto && actualizarClientePresupuesto) {
    dataUpdate.clienteId = proyecto.clienteId
  }

  const actualizado = await prisma.presupuesto.update({
    where: { id: presupuestoId },
    data: dataUpdate,
    select: { id: true, numero: true, proyectoId: true, clienteId: true },
  })

  return NextResponse.json({ ok: true, presupuesto: actualizado })
})
