import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('documentos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const documentoId = parseInt(id)
  if (isNaN(documentoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const comentarios = await prisma.comentarioDocumento.findMany({
    where: { documentoId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(comentarios)
})

export const POST = withPermiso('documentos', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const documentoId = parseInt(id)
  if (isNaN(documentoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { autorNombre, contenido, usuarioId } = body

  if (!autorNombre || !contenido?.trim()) {
    return NextResponse.json({ error: 'Autor y contenido son requeridos' }, { status: 400 })
  }

  const comentario = await prisma.comentarioDocumento.create({
    data: {
      documentoId,
      autorNombre,
      contenido: contenido.trim(),
      usuarioId: usuarioId || null,
    },
  })

  return NextResponse.json(comentario, { status: 201 })
})

export const DELETE = withPermiso('documentos', 'editar', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const comentarioId = parseInt(searchParams.get('comentarioId') ?? '')
  if (isNaN(comentarioId)) return NextResponse.json({ error: 'comentarioId requerido' }, { status: 400 })

  await prisma.comentarioDocumento.delete({ where: { id: comentarioId } })
  return NextResponse.json({ ok: true })
})
