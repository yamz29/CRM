import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id: numId },
    include: { cliente: true },
  })
  if (!oportunidad) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const body = await req.json()
  const { nombreProyecto, tipoProyecto, fechaInicio } = body

  if (!nombreProyecto) {
    return NextResponse.json({ error: 'nombreProyecto es requerido' }, { status: 400 })
  }

  const [proyecto] = await prisma.$transaction([
    prisma.proyecto.create({
      data: {
        nombre: nombreProyecto,
        clienteId: oportunidad.clienteId,
        tipoProyecto: tipoProyecto ?? 'Remodelación',
        estado: 'Adjudicado',
        presupuestoEstimado: oportunidad.valor ?? null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      },
    }),
    prisma.oportunidad.update({
      where: { id: numId },
      data: { etapa: 'Ganado' },
    }),
  ])

  // Actualizar la oportunidad con el proyectoId (no se puede en la misma transaction con SQLite fácilmente)
  await prisma.oportunidad.update({
    where: { id: numId },
    data: { proyectoId: proyecto.id },
  })

  return NextResponse.json({ proyectoId: proyecto.id, proyecto })
}
