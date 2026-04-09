import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// GET /api/proyectos/[id]/punchlist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'ver')
  if (denied) return denied

  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const items = await prisma.punchItem.findMany({
    where: { proyectoId },
    orderBy: [
      { estado: 'asc' },
      { prioridad: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return NextResponse.json(items)
}

// POST /api/proyectos/[id]/punchlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const titulo = body.titulo?.toString().trim()
    if (!titulo) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })

    const prioridadesValidas = ['baja', 'media', 'alta', 'critica']
    const prioridad = prioridadesValidas.includes(body.prioridad) ? body.prioridad : 'media'

    const userId = request.headers.get('x-user-id')

    const item = await prisma.punchItem.create({
      data: {
        proyectoId,
        titulo,
        descripcion: body.descripcion?.toString().trim() || null,
        ubicacion: body.ubicacion?.toString().trim() || null,
        categoria: body.categoria?.toString().trim() || null,
        prioridad,
        asignadoA: body.asignadoA?.toString().trim() || null,
        fechaLimite: body.fechaLimite ? new Date(body.fechaLimite) : null,
        createdById: userId ? parseInt(userId) : null,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
