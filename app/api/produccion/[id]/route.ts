import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ETAPAS_PRODUCCION, ETAPA_ORDER } from '@/lib/produccion'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: parseInt(id) },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      items: {
        include: {
          asignaciones: {
            where: { activo: true },
            include: { usuario: { select: { id: true, nombre: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      materiales: {
        include: { material: { select: { id: true, nombre: true, tipo: true } } },
        orderBy: { nombre: 'asc' },
      },
      asignaciones: {
        where: { activo: true },
        include: { usuario: { select: { id: true, nombre: true } } },
      },
    },
  })

  if (!orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  return NextResponse.json(orden)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  try {
    // Stage advancement
    if (body._avanzarEtapa) {
      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: parseInt(id) },
      })
      if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

      const currentIdx = ETAPA_ORDER[orden.etapaActual] ?? 0
      const nextIdx = currentIdx + 1

      if (nextIdx >= ETAPAS_PRODUCCION.length) {
        return NextResponse.json({ error: 'La orden ya está en la última etapa' }, { status: 400 })
      }

      // QC gate-keeping
      if (orden.etapaActual === 'QC Proceso') {
        const checklist = orden.checklistQCProceso ? JSON.parse(orden.checklistQCProceso) : []
        const allChecked = checklist.length > 0 && checklist.every((c: { checked: boolean }) => c.checked)
        if (!allChecked) {
          return NextResponse.json(
            { error: 'Debe completar el checklist de QC Proceso antes de avanzar' },
            { status: 400 }
          )
        }
      }
      if (orden.etapaActual === 'QC Final') {
        const checklist = orden.checklistQCFinal ? JSON.parse(orden.checklistQCFinal) : []
        const allChecked = checklist.length > 0 && checklist.every((c: { checked: boolean }) => c.checked)
        if (!allChecked) {
          return NextResponse.json(
            { error: 'Debe completar el checklist de QC Final antes de completar' },
            { status: 400 }
          )
        }
      }

      const nextEtapa = ETAPAS_PRODUCCION[nextIdx].key
      const isLastStage = nextIdx === ETAPAS_PRODUCCION.length - 1

      const updated = await prisma.ordenProduccion.update({
        where: { id: parseInt(id) },
        data: {
          etapaActual: nextEtapa,
          estado: 'En Proceso',
          ...(orden.etapaActual === 'Compra de Materiales' && !orden.fechaInicio && { fechaInicio: new Date() }),
          ...(isLastStage && orden.etapaActual === 'QC Final' && {
            estado: 'Completada',
            fechaCompletada: new Date(),
          }),
        },
      })

      return NextResponse.json(updated)
    }

    // Complete order (from QC Final)
    if (body._completar) {
      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: parseInt(id) },
      })
      if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

      if (orden.etapaActual !== 'QC Final') {
        return NextResponse.json({ error: 'Solo se puede completar desde QC Final' }, { status: 400 })
      }

      const checklist = orden.checklistQCFinal ? JSON.parse(orden.checklistQCFinal) : []
      const allChecked = checklist.length > 0 && checklist.every((c: { checked: boolean }) => c.checked)
      if (!allChecked) {
        return NextResponse.json(
          { error: 'Debe completar el checklist de QC Final' },
          { status: 400 }
        )
      }

      const updated = await prisma.ordenProduccion.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'Completada',
          fechaCompletada: new Date(),
        },
      })

      // Mark all items as completed
      await prisma.itemProduccion.updateMany({
        where: { ordenId: parseInt(id) },
        data: { completado: true },
      })

      return NextResponse.json(updated)
    }

    // General update
    const orden = await prisma.ordenProduccion.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.prioridad !== undefined && { prioridad: body.prioridad }),
        ...(body.estado !== undefined && { estado: body.estado }),
        ...(body.fechaInicio !== undefined && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
        ...(body.fechaEstimada !== undefined && { fechaEstimada: body.fechaEstimada ? new Date(body.fechaEstimada) : null }),
        ...(body.notas !== undefined && { notas: body.notas }),
        ...(body.proyectoId !== undefined && { proyectoId: body.proyectoId ? parseInt(body.proyectoId) : null }),
        ...(body.checklistQCProceso !== undefined && {
          checklistQCProceso: typeof body.checklistQCProceso === 'string'
            ? body.checklistQCProceso
            : JSON.stringify(body.checklistQCProceso),
        }),
        ...(body.checklistQCFinal !== undefined && {
          checklistQCFinal: typeof body.checklistQCFinal === 'string'
            ? body.checklistQCFinal
            : JSON.stringify(body.checklistQCFinal),
        }),
        ...(body.estado === 'Completada' && { fechaCompletada: new Date() }),
      },
    })

    return NextResponse.json(orden)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar orden' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params

  try {
    await prisma.ordenProduccion.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar orden' }, { status: 500 })
  }
}
