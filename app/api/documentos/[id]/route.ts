import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const docId = parseInt(id)
  if (isNaN(docId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const documento = await prisma.documentoProyecto.findUnique({
    where: { id: docId },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      oportunidad: { select: { id: true, nombre: true } },
    },
  })

  if (!documento) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(documento)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const docId = parseInt(id)
  if (isNaN(docId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { nombre, categoria, url, descripcion, etiquetas, subidoPor, fechaDocumento, tamanioRef, proyectoId, oportunidadId } = body

  const documento = await prisma.documentoProyecto.update({
    where: { id: docId },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(categoria !== undefined ? { categoria } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
      ...(etiquetas !== undefined ? { etiquetas: etiquetas ? JSON.stringify(etiquetas) : null } : {}),
      ...(subidoPor !== undefined ? { subidoPor: subidoPor || null } : {}),
      ...(fechaDocumento !== undefined ? { fechaDocumento: fechaDocumento ? new Date(fechaDocumento) : null } : {}),
      ...(tamanioRef !== undefined ? { tamanioRef: tamanioRef || null } : {}),
      ...(proyectoId !== undefined ? { proyectoId: proyectoId || null } : {}),
      ...(oportunidadId !== undefined ? { oportunidadId: oportunidadId || null } : {}),
    },
  })

  return NextResponse.json(documento)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const docId = parseInt(id)
  if (isNaN(docId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.documentoProyecto.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
