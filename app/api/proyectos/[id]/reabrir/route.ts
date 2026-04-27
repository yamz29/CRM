import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/proyectos/[id]/reabrir
 *
 * Reabre un proyecto cerrado. SOLO usuarios con rol 'Admin' pueden hacerlo.
 * Vuelve el estado a 'En Ejecución' y limpia los campos de cierre. La
 * decisión es intencional: el cierre debe ser un acto formal, y reabrir
 * uno es admitir que el cierre fue prematuro o equivocado — eso queda
 * registrado en logs.
 */
export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  // Solo Admin puede reabrir
  const rol = req.headers.get('x-user-rol')
  if (rol !== 'Admin') {
    return NextResponse.json(
      { error: 'Solo administradores pueden reabrir un proyecto cerrado' },
      { status: 403 }
    )
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true, estado: true, fechaCierre: true, codigo: true, nombre: true },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  if (proyecto.estado !== 'Cerrado') {
    return NextResponse.json(
      { error: 'El proyecto no está cerrado, no hace falta reabrirlo' },
      { status: 409 }
    )
  }

  const userId = req.headers.get('x-user-id')
  const userNombre = req.headers.get('x-user-nombre')
  console.warn(
    `[reabrir-proyecto] proyecto ${proyecto.codigo ?? proyecto.id} (${proyecto.nombre}) ` +
    `reabierto por ${userNombre ?? userId ?? '???'} — fechaCierre era ${proyecto.fechaCierre?.toISOString() ?? '?'}`
  )

  const actualizado = await prisma.proyecto.update({
    where: { id: proyectoId },
    data: {
      estado: 'En Ejecución',
      fechaCierre: null,
      cerradoPorId: null,
      // Preservamos observacionesCierre — pueden servir si se cierra de nuevo.
    },
    select: { id: true, estado: true },
  })

  return NextResponse.json({ ok: true, proyecto: actualizado })
})
