import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/proyectos/[id]/presupuestos-vinculables
 *
 * Lista presupuestos del MISMO cliente del proyecto que NO estén ya
 * vinculados a este proyecto. Incluye presupuestos sin proyecto y los
 * que están en otro proyecto (con flag `enOtroProyecto` para advertir
 * en la UI antes de robarles el vínculo).
 */
export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
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

  // Presupuestos del mismo cliente, NO ya vinculados a ESTE proyecto.
  const presupuestos = await prisma.presupuesto.findMany({
    where: {
      clienteId: proyecto.clienteId,
      NOT: { proyectoId },
    },
    select: {
      id: true,
      numero: true,
      total: true,
      estado: true,
      createdAt: true,
      proyectoId: true,
      proyecto: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(presupuestos.map(p => ({
    id: p.id,
    numero: p.numero,
    total: p.total,
    estado: p.estado,
    createdAt: p.createdAt,
    enOtroProyecto: p.proyectoId != null,
    proyectoActualNombre: p.proyecto?.nombre ?? null,
  })))
})
