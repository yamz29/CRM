import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'

// GET /api/proyectos/[id]/adicionales — lista de adicionales del proyecto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'ver')
  if (denied) return denied

  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const adicionales = await prisma.adicionalProyecto.findMany({
    where: { proyectoId },
    orderBy: [{ fechaPropuesta: 'desc' }, { id: 'desc' }],
  })

  return NextResponse.json(adicionales)
}

// POST /api/proyectos/[id]/adicionales — crear adicional
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const cerrado = await validarProyectoNoCerrado(proyectoId)
  if (cerrado) return cerrado

  try {
    const body = await request.json()
    const titulo = body.titulo?.toString().trim()
    if (!titulo) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }
    const monto = parseFloat(body.monto)
    if (isNaN(monto) || monto < 0) {
      return NextResponse.json({ error: 'El monto debe ser un número ≥ 0' }, { status: 400 })
    }

    const userId = request.headers.get('x-user-id')

    const adicional = await prisma.adicionalProyecto.create({
      data: {
        proyectoId,
        numero: body.numero?.toString().trim() || null,
        titulo,
        descripcion: body.descripcion?.toString().trim() || null,
        monto,
        estado: body.estado || 'propuesto',
        notas: body.notas?.toString().trim() || null,
        createdById: userId ? parseInt(userId) : null,
      },
    })

    return NextResponse.json(adicional)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear adicional'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
