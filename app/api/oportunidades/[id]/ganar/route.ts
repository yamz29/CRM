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

  const proyecto = await prisma.$transaction(async (tx) => {
    const nuevoProyecto = await tx.proyecto.create({
      data: {
        nombre: nombreProyecto,
        clienteId: oportunidad.clienteId,
        tipoProyecto: tipoProyecto ?? 'Remodelación',
        estado: 'Adjudicado',
        presupuestoEstimado: oportunidad.valor ?? null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      },
    })

    // Vincular la oportunidad al proyecto nuevo y marcarla como Ganada
    await tx.oportunidad.update({
      where: { id: numId },
      data: { etapa: 'Ganado', proyectoId: nuevoProyecto.id },
    })

    // Transferir todos los presupuestos de la oportunidad al proyecto nuevo
    await tx.presupuesto.updateMany({
      where: { oportunidadId: numId },
      data: { proyectoId: nuevoProyecto.id },
    })

    return nuevoProyecto
  })

  return NextResponse.json({ proyectoId: proyecto.id, proyecto })
}
