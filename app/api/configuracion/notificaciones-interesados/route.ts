import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

/**
 * GET /api/configuracion/notificaciones-interesados
 * PUT /api/configuracion/notificaciones-interesados
 * Body: { interesadosIds: number[] }
 *
 * Lista de "interesados" en notificaciones del sistema. Es global: cualquier
 * evento del sistema notifica a todos los marcados como interesados.
 *
 * Solo admin puede modificarla.
 */
export const GET = withPermiso('configuracion', 'ver', async () => {
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: {
      id: true, nombre: true, correo: true, rol: true,
      esInteresadoNotificaciones: true,
      _count: { select: { pushSubscriptions: true } },
    },
    orderBy: { nombre: 'asc' },
  })
  return NextResponse.json(usuarios)
})

export const PUT = withPermiso('configuracion', 'editar', async (req: NextRequest) => {
  const rol = req.headers.get('x-user-rol')
  if (rol !== 'Admin') {
    return NextResponse.json({ error: 'Solo admins pueden modificar la lista de interesados' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const ids = Array.isArray(body?.interesadosIds) ? body.interesadosIds.map(Number).filter((n: number) => !isNaN(n)) : null
  if (!ids) {
    return NextResponse.json({ error: 'interesadosIds requerido (array)' }, { status: 400 })
  }

  await prisma.$transaction([
    // Limpiar a todos
    prisma.usuario.updateMany({ data: { esInteresadoNotificaciones: false } }),
    // Marcar a los seleccionados
    prisma.usuario.updateMany({
      where: { id: { in: ids } },
      data: { esInteresadoNotificaciones: true },
    }),
  ])

  return NextResponse.json({ ok: true, count: ids.length })
})
