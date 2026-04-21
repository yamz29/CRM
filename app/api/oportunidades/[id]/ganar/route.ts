import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const POST = withPermiso('oportunidades', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id: numId },
    include: { cliente: true },
  })
  if (!oportunidad) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Idempotencia: si ya fue ganada y tiene proyecto, retornar el existente
  if (oportunidad.etapa === 'Ganado' && oportunidad.proyectoId) {
    return NextResponse.json({ proyectoId: oportunidad.proyectoId, mensaje: 'Oportunidad ya fue ganada anteriormente' })
  }

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

    // Migrar tareas pendientes/en proceso de la oportunidad al proyecto
    await tx.tarea.updateMany({
      where: {
        oportunidadId: numId,
        estado: { in: ['Pendiente', 'En proceso'] },
      },
      data: { proyectoId: nuevoProyecto.id },
    })

    return nuevoProyecto
  })

  return NextResponse.json({ proyectoId: proyecto.id, proyecto })
})
