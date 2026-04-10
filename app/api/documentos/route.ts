import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const proyectoId = searchParams.get('proyectoId')
  const oportunidadId = searchParams.get('oportunidadId')
  const categoria = searchParams.get('categoria')
  const q = searchParams.get('q')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (proyectoId) where.proyectoId = parseInt(proyectoId)
  if (oportunidadId) where.oportunidadId = parseInt(oportunidadId)
  if (categoria) where.categoria = categoria

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { descripcion: { contains: q, mode: 'insensitive' } },
      { etiquetas: { contains: q, mode: 'insensitive' } },
    ]
  }

  const documentos = await prisma.documentoProyecto.findMany({
    where,
    include: {
      proyecto: { select: { id: true, nombre: true } },
      oportunidad: { select: { id: true, nombre: true } },
      _count: { select: { comentarios: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(documentos)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    proyectoId, oportunidadId, nombre, categoria,
    url, descripcion, etiquetas, subidoPor, fechaDocumento, tamanioRef,
  } = body

  if (!nombre || !url) {
    return NextResponse.json({ error: 'Nombre y URL son requeridos' }, { status: 400 })
  }

  const documento = await prisma.documentoProyecto.create({
    data: {
      proyectoId: proyectoId ? parseInt(proyectoId) : null,
      oportunidadId: oportunidadId ? parseInt(oportunidadId) : null,
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
}
