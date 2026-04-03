import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ETAPA_ORDER } from '@/lib/produccion'

type Params = { params: Promise<{ id: string; itemId: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params
  const body = await req.json()

  try {
    const currentItem = await prisma.itemProduccion.findUnique({
      where: { id: parseInt(itemId) },
    })
    if (!currentItem) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
    }

    // Stage change with QC gate-keeping
    if (body.etapa && body._patch) {
      const currentEtapaIdx = ETAPA_ORDER[currentItem.etapa] ?? 0
      const newEtapaIdx = ETAPA_ORDER[body.etapa] ?? 0

      // Validate QC before advancing past QC stages
      if (currentItem.etapa === 'QC Proceso' && newEtapaIdx > currentEtapaIdx) {
        const checklist = currentItem.checklistQCProceso
          ? JSON.parse(currentItem.checklistQCProceso)
          : []
        const allChecked = checklist.length > 0 && checklist.every((c: { checked: boolean }) => c.checked)
        if (!allChecked) {
          return NextResponse.json(
            { error: 'Debe completar el checklist de QC Proceso antes de avanzar' },
            { status: 400 }
          )
        }
      }

      if (currentItem.etapa === 'QC Final' && newEtapaIdx > currentEtapaIdx) {
        const checklist = currentItem.checklistQCFinal
          ? JSON.parse(currentItem.checklistQCFinal)
          : []
        const allChecked = checklist.length > 0 && checklist.every((c: { checked: boolean }) => c.checked)
        if (!allChecked) {
          return NextResponse.json(
            { error: 'Debe completar el checklist de QC Final antes de completar' },
            { status: 400 }
          )
        }
      }

      const isComplete = body.etapa === 'QC Final' && currentItem.etapa !== 'QC Final'
        ? false
        : body.completado ?? currentItem.completado

      const updated = await prisma.itemProduccion.update({
        where: { id: parseInt(itemId) },
        data: {
          etapa: body.etapa,
          fechaInicioEtapa: new Date(),
          completado: isComplete,
          ...(isComplete && { fechaCompletado: new Date() }),
        },
      })

      // Check if all items are complete to auto-complete order
      if (isComplete) {
        const allItems = await prisma.itemProduccion.findMany({
          where: { ordenId: parseInt(id) },
          select: { completado: true },
        })
        const allDone = allItems.every((i) => i.completado)
        if (allDone) {
          await prisma.ordenProduccion.update({
            where: { id: parseInt(id) },
            data: { estado: 'Completada', fechaCompletada: new Date() },
          })
        }
      }

      return NextResponse.json(updated)
    }

    // General update (QC checklist, observaciones, etc.)
    const updated = await prisma.itemProduccion.update({
      where: { id: parseInt(itemId) },
      data: {
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
        ...(body.observaciones !== undefined && { observaciones: body.observaciones }),
        ...(body.prioridad !== undefined && { prioridad: body.prioridad }),
        ...(body.nombreModulo !== undefined && { nombreModulo: body.nombreModulo }),
        ...(body.completado !== undefined && {
          completado: body.completado,
          ...(body.completado && { fechaCompletado: new Date() }),
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { itemId } = await params

  try {
    await prisma.itemProduccion.delete({ where: { id: parseInt(itemId) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar item' }, { status: 500 })
  }
}
