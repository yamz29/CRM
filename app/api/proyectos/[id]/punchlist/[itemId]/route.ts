import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// PUT /api/proyectos/[id]/punchlist/[itemId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { itemId: aidStr } = await params
  const itemId = parseInt(aidStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.titulo !== undefined) {
      const titulo = body.titulo?.toString().trim()
      if (!titulo) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
      data.titulo = titulo
    }
    if (body.descripcion !== undefined) data.descripcion = body.descripcion?.toString().trim() || null
    if (body.ubicacion !== undefined) data.ubicacion = body.ubicacion?.toString().trim() || null
    if (body.categoria !== undefined) data.categoria = body.categoria?.toString().trim() || null
    if (body.asignadoA !== undefined) data.asignadoA = body.asignadoA?.toString().trim() || null
    if (body.resolucionNotas !== undefined) data.resolucionNotas = body.resolucionNotas?.toString().trim() || null
    if (body.verificadoPor !== undefined) data.verificadoPor = body.verificadoPor?.toString().trim() || null
    if (body.fechaLimite !== undefined) data.fechaLimite = body.fechaLimite ? new Date(body.fechaLimite) : null
    if (body.fotos !== undefined) data.fotos = typeof body.fotos === 'string' ? body.fotos : JSON.stringify(body.fotos)

    if (body.prioridad !== undefined) {
      const validas = ['baja', 'media', 'alta', 'critica']
      if (validas.includes(body.prioridad)) data.prioridad = body.prioridad
    }

    if (body.estado !== undefined) {
      const estadosValidos = ['abierto', 'en_progreso', 'resuelto', 'verificado', 'cerrado']
      if (!estadosValidos.includes(body.estado)) {
        return NextResponse.json({ error: `Estado inválido. Use: ${estadosValidos.join(', ')}` }, { status: 400 })
      }
      data.estado = body.estado
      if (body.estado === 'resuelto') {
        const actual = await prisma.punchItem.findUnique({ where: { id: itemId }, select: { resueltoEn: true } })
        if (!actual?.resueltoEn) data.resueltoEn = new Date()
      }
      if (body.estado === 'verificado') {
        const actual = await prisma.punchItem.findUnique({ where: { id: itemId }, select: { verificadoEn: true } })
        if (!actual?.verificadoEn) data.verificadoEn = new Date()
      }
    }

    const item = await prisma.punchItem.update({ where: { id: itemId }, data })
    return NextResponse.json(item)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/proyectos/[id]/punchlist/[itemId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { itemId: aidStr } = await params
  const itemId = parseInt(aidStr)
  if (isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.punchItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
