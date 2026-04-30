import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/proyectos/[id]/presupuestos-vinculables[?todos=1]
 *
 * Por default lista presupuestos del MISMO cliente del proyecto, NO ya
 * vinculados a este proyecto. Incluye los sin proyecto y los que están
 * en otro proyecto (flag `enOtroProyecto`).
 *
 * Con ?todos=1 muestra TODOS los presupuestos del sistema (escape hatch
 * para casos donde el clienteId no quedó bien seteado en el presupuesto
 * o se creó desde otro flujo). Devuelve un flag `clienteCoincide` por
 * cada uno para que la UI pueda advertir cuando el cliente no calza.
 */
export const GET = withPermiso('proyectos', 'ver', async (req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true, clienteId: true },
  })
  if (!proyecto) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const todos = req.nextUrl.searchParams.get('todos') === '1'

  const presupuestos = await prisma.presupuesto.findMany({
    where: todos
      ? { NOT: { proyectoId } }
      : { clienteId: proyecto.clienteId, NOT: { proyectoId } },
    select: {
      id: true,
      numero: true,
      total: true,
      estado: true,
      createdAt: true,
      proyectoId: true,
      clienteId: true,
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: todos ? 200 : 50,
  })

  return NextResponse.json(presupuestos.map(p => ({
    id: p.id,
    numero: p.numero,
    total: p.total,
    estado: p.estado,
    createdAt: p.createdAt,
    enOtroProyecto: p.proyectoId != null,
    proyectoActualNombre: p.proyecto?.nombre ?? null,
    clienteCoincide: p.clienteId === proyecto.clienteId,
    clienteActualNombre: p.cliente?.nombre ?? null,
  })))
})
