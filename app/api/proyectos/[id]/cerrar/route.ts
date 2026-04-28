import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/proyectos/[id]/cerrar
 * Body: { observaciones?: string, forzarConAdvertencias?: boolean }
 *
 * Cierra el proyecto si no tiene bloqueantes. Si tiene advertencias,
 * requiere que el cliente confirme con `forzarConAdvertencias: true`.
 *
 * Marca estado='Cerrado', fechaCierre, cerradoPorId. Una vez cerrado,
 * los endpoints de gastos/facturas/adicionales/cronograma rechazan
 * modificaciones (validación en cada uno por separado).
 */
export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const observaciones = typeof body.observaciones === 'string' ? body.observaciones.trim() || null : null
  const forzarConAdvertencias = body.forzarConAdvertencias === true

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true, estado: true, avanceFisico: true },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  if (proyecto.estado === 'Cerrado') {
    return NextResponse.json({ error: 'El proyecto ya está cerrado' }, { status: 409 })
  }

  // ── Re-evaluar bloqueantes (server-side authoritative) ───────────────
  // El cliente ya los vio, pero aquí los volvemos a calcular para evitar
  // race conditions (alguien modificó algo entre el check y el cierre).
  const facturasPend = await prisma.factura.findMany({
    where: { proyectoId, estado: { not: 'anulada' } },
    select: { tipo: true, total: true, montoPagado: true, esProforma: true },
  })
  // Para el cierre miramos flujo de caja, no estado fiscal: proformas pagadas
  // suman, proformas con saldo bloquean igual que facturas fiscales.
  const ingresoPendCount = facturasPend.filter(
    f => f.tipo === 'ingreso' && (f.total - f.montoPagado) > 0.01
  ).length
  const egresoPendCount = facturasPend.filter(
    f => f.tipo === 'egreso' && (f.total - f.montoPagado) > 0.01
  ).length
  const adicPropuestos = await prisma.adicionalProyecto.count({
    where: { proyectoId, estado: 'propuesto' },
  })

  const bloqueantes: string[] = []
  if (ingresoPendCount > 0) bloqueantes.push(`${ingresoPendCount} factura(s) de ingreso sin cobrar`)
  if (egresoPendCount > 0) bloqueantes.push(`${egresoPendCount} factura(s) de egreso sin pagar`)
  if (adicPropuestos > 0) bloqueantes.push(`${adicPropuestos} adicional(es) en estado "propuesto"`)

  if (bloqueantes.length > 0) {
    return NextResponse.json(
      { error: 'No se puede cerrar', bloqueantes },
      { status: 422 }
    )
  }

  // ── Advertencias (no bloquean, pero requieren confirmación) ─────────
  const advertencias: string[] = []
  if (proyecto.avanceFisico < 100) {
    advertencias.push(`Avance físico al ${proyecto.avanceFisico}%`)
  }
  // Otras advertencias (cronograma, punchlist, gastos sin clasificar, margen negativo)
  // se calculan y se muestran en /cierre-checks pero aquí no bloquean — el front ya
  // mostró todas y el usuario marcó forzarConAdvertencias=true. Para mantener simple
  // este endpoint, solo verificamos avance físico como sanity check.
  if (advertencias.length > 0 && !forzarConAdvertencias) {
    return NextResponse.json(
      { error: 'Hay advertencias pendientes. Confirma el cierre desde la UI.', advertencias },
      { status: 422 }
    )
  }

  // ── Cerrar ──────────────────────────────────────────────────────────
  const userId = req.headers.get('x-user-id')
  const cerradoPorId = userId ? parseInt(userId) : null

  const actualizado = await prisma.proyecto.update({
    where: { id: proyectoId },
    data: {
      estado: 'Cerrado',
      fechaCierre: new Date(),
      cerradoPorId,
      observacionesCierre: observaciones,
    },
    select: { id: true, estado: true, fechaCierre: true },
  })

  return NextResponse.json({ ok: true, proyecto: actualizado })
})
