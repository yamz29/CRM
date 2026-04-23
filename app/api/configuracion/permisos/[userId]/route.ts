import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MODULOS, type NivelPermiso } from '@/lib/permisos'
import { getSession } from '@/lib/auth'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ userId: string }> }

// GET /api/configuracion/permisos/[userId] → devuelve PermisosMap del usuario
export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest, { params }: Params) => {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const numId = parseInt(userId)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const rows = await prisma.permisoUsuario.findMany({ where: { usuarioId: numId } })
  const map: Record<string, NivelPermiso> = {}
  for (const r of rows) map[r.modulo] = r.nivel as NivelPermiso

  return NextResponse.json(map)
})

// PUT /api/configuracion/permisos/[userId] → guarda permisos completos del usuario
// body: { dashboard: 'editar', clientes: 'ver', ... }
export const PUT = withPermiso('configuracion', 'editar', async (req: NextRequest, { params }: Params) => {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.rol !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const numId = parseInt(userId)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json() as Record<string, string>
  const NIVELES_VALIDOS = ['ninguno', 'ver', 'editar', 'admin']
  const modulosValidos = MODULOS.map(m => m.key)

  // Upsert cada módulo recibido
  await prisma.$transaction(
    Object.entries(body)
      .filter(([modulo, nivel]) => modulosValidos.includes(modulo as never) && NIVELES_VALIDOS.includes(nivel))
      .map(([modulo, nivel]) =>
        prisma.permisoUsuario.upsert({
          where: { usuarioId_modulo: { usuarioId: numId, modulo } },
          create: { usuarioId: numId, modulo, nivel },
          update: { nivel },
        })
      )
  )

  return NextResponse.json({ ok: true })
})
