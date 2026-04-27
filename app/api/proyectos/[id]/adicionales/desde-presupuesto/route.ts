import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/proyectos/[id]/adicionales/desde-presupuesto
 * Body: { presupuestoId: number, estado?: 'propuesto' | 'aprobado' }
 *
 * Crea un AdicionalProyecto a partir de un presupuesto vinculado al
 * proyecto. Útil cuando el usuario maneja un presupuesto separado para
 * los adicionales/Change Orders y quiere registrarlo en el control de
 * Adicionales del proyecto sin re-tipear los datos.
 *
 * Reglas:
 * - El presupuesto debe estar vinculado a este proyecto (proyectoId match).
 * - El monto del adicional = total del presupuesto.
 * - Se preserva trazabilidad en `notas`: "Generado desde presupuesto {numero}".
 * - No se aplica unicidad por presupuestoId — el endpoint permite crear
 *   múltiples adicionales del mismo origen (raro pero posible). El frontend
 *   advierte con un confirm si ya existe.
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
  const estadoIn = String(body.estado || 'propuesto')
  const estado = ['propuesto', 'aprobado'].includes(estadoIn) ? estadoIn : 'propuesto'

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    select: {
      id: true, numero: true, total: true, notas: true, estado: true,
      proyectoId: true, proyecto: { select: { nombre: true } },
    },
  })
  if (!presupuesto) {
    return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
  }

  if (presupuesto.proyectoId !== proyectoId) {
    return NextResponse.json(
      { error: 'El presupuesto no está vinculado a este proyecto. Vincúlalo primero.' },
      { status: 422 }
    )
  }

  const userId = request.headers.get('x-user-id')

  const adicional = await prisma.adicionalProyecto.create({
    data: {
      proyectoId,
      numero: presupuesto.numero, // sirve como referencia visual
      titulo: `Adicional — ${presupuesto.numero}`,
      descripcion: presupuesto.notas?.trim() || null,
      monto: presupuesto.total,
      estado,
      // Si el usuario eligió aprobado, registramos también la fecha
      ...(estado === 'aprobado' ? { fechaAprobacion: new Date() } : {}),
      notas: `Generado automáticamente desde presupuesto ${presupuesto.numero}`,
      createdById: userId ? parseInt(userId) : null,
    },
  })

  return NextResponse.json(adicional, { status: 201 })
})
