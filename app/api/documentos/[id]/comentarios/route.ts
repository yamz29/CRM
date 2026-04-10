import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const documentoId = parseInt(id)
  if (isNaN(documentoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const comentarios = await prisma.comentarioDocumento.findMany({
    where: { documentoId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(comentarios)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const comentarioId = parseInt(searchParams.get('comentarioId') ?? '')
  if (isNaN(comentarioId)) return NextResponse.json({ error: 'comentarioId requerido' }, { status: 400 })

  await prisma.comentarioDocumento.delete({ where: { id: comentarioId } })
  return NextResponse.json({ ok: true })
}
