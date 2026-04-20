import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

const TIPOS = ['compra', 'tarea'] as const
const PRIORIDADES = ['Alta', 'Normal', 'Baja'] as const
const ESTADOS = ['Pendiente', 'En Progreso', 'Completado', 'Cancelado'] as const

// GET /api/proyectos/[id]/programa?tipo=compra|tarea
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'ver')
  if (denied) return denied

  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const tipo = request.nextUrl.searchParams.get('tipo')
  const where: { proyectoId: number; tipo?: string } = { proyectoId }
  if (tipo && (TIPOS as readonly string[]).includes(tipo)) where.tipo = tipo

  const items = await prisma.itemProgramaProyecto.findMany({
    where,
    orderBy: [
      { estado: 'asc' }, // Pendiente primero (alfabéticamente)
      { orden: 'asc' },
      { fechaObjetivo: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      ordenCompra: { select: { id: true, numero: true, estado: true } },
    },
  })

  return NextResponse.json(items)
}

// POST /api/proyectos/[id]/programa
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
    const tipo = (TIPOS as readonly string[]).includes(body.tipo) ? body.tipo : null
    if (!tipo) return NextResponse.json({ error: 'tipo debe ser "compra" o "tarea"' }, { status: 400 })

    const descripcion = body.descripcion?.toString().trim()
    if (!descripcion) return NextResponse.json({ error: 'La descripción es obligatoria' }, { status: 400 })

    const prioridad = (PRIORIDADES as readonly string[]).includes(body.prioridad) ? body.prioridad : 'Normal'

    const item = await prisma.itemProgramaProyecto.create({
      data: {
        proyectoId,
        tipo,
        descripcion,
        cantidad: tipo === 'compra' ? body.cantidad?.toString().trim() || null : null,
        fechaObjetivo: body.fechaObjetivo ? new Date(body.fechaObjetivo) : null,
        prioridad,
        estado: 'Pendiente',
        notas: body.notas?.toString().trim() || null,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al crear'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
