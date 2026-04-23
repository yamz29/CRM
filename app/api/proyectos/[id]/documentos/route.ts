import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const documentos = await prisma.documentoProyecto.findMany({
    where: { proyectoId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(documentos)
})

export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { nombre, categoria, url, descripcion, etiquetas, subidoPor, fechaDocumento, tamanioRef } = body

  if (!nombre || !url) {
    return NextResponse.json({ error: 'Nombre y URL son requeridos' }, { status: 400 })
  }

  const documento = await prisma.documentoProyecto.create({
    data: {
      proyectoId,
      nombre,
      categoria: categoria || 'General',
      url,
      descripcion: descripcion || null,
      etiquetas: etiquetas ? JSON.stringify(etiquetas) : null,
      subidoPor: subidoPor || null,
      fechaDocumento: fechaDocumento ? new Date(fechaDocumento) : null,
      tamanioRef: tamanioRef || null,
    },
  })

  return NextResponse.json(documento, { status: 201 })
})

export const PUT = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { documentoId, nombre, categoria, url, descripcion, etiquetas, subidoPor, fechaDocumento, tamanioRef } = body

  if (!documentoId) return NextResponse.json({ error: 'documentoId requerido' }, { status: 400 })

  const documento = await prisma.documentoProyecto.update({
    where: { id: documentoId },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(categoria !== undefined ? { categoria } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
      ...(etiquetas !== undefined ? { etiquetas: etiquetas ? JSON.stringify(etiquetas) : null } : {}),
      ...(subidoPor !== undefined ? { subidoPor: subidoPor || null } : {}),
      ...(fechaDocumento !== undefined ? { fechaDocumento: fechaDocumento ? new Date(fechaDocumento) : null } : {}),
      ...(tamanioRef !== undefined ? { tamanioRef: tamanioRef || null } : {}),
    },
  })

  return NextResponse.json(documento)
})

export const DELETE = withPermiso('proyectos', 'editar', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const documentoId = parseInt(searchParams.get('documentoId') ?? '')
  if (isNaN(documentoId)) return NextResponse.json({ error: 'documentoId requerido' }, { status: 400 })

  await prisma.documentoProyecto.delete({ where: { id: documentoId } })
  return NextResponse.json({ ok: true })
})
