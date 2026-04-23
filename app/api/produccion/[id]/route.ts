import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ETAPAS_PRODUCCION, ETAPA_ORDER } from '@/lib/produccion'
import type { EtapaLog } from '@/lib/produccion'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string }> }

// Helper: update etapasLog when stage changes
function updateEtapasLog(currentLog: string | null, fromEtapa: string, toEtapa: string): string {
  let log: EtapaLog[] = []
  try { log = currentLog ? JSON.parse(currentLog) : [] } catch { log = [] }

  const now = new Date().toISOString()

  // Close current stage
  const currentEntry = log.find(e => e.etapa === fromEtapa && !e.fin)
  if (currentEntry) {
    currentEntry.fin = now
  }

  // Open new stage (if not already in log)
  const existingNew = log.find(e => e.etapa === toEtapa && !e.fin)
  if (!existingNew) {
    log.push({ etapa: toEtapa, inicio: now, fin: null })
  }

  return JSON.stringify(log)
}

export const GET = withPermiso('produccion', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: parseInt(id) },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      items: {
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
})

export const PUT = withPermiso('produccion', 'editar', async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const body = await req.json()

  try {
    // ── Advance stage forward ──
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
      const etapasLog = updateEtapasLog(orden.etapasLog, orden.etapaActual, nextEtapa)

      const updated = await prisma.ordenProduccion.update({
        where: { id: parseInt(id) },
        data: {
          etapaActual: nextEtapa,
          estado: 'En Proceso',
          etapasLog,
          ...(!orden.fechaInicio && { fechaInicio: new Date() }),
        },
      })

      return NextResponse.json(updated)
    }

    // ── Go back one stage ──
    if (body._retrocederEtapa) {
      const orden = await prisma.ordenProduccion.findUnique({
        where: { id: parseInt(id) },
      })
      if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

      const currentIdx = ETAPA_ORDER[orden.etapaActual] ?? 0
      if (currentIdx === 0) {
        return NextResponse.json({ error: 'Ya está en la primera etapa' }, { status: 400 })
      }

      const prevEtapa = ETAPAS_PRODUCCION[currentIdx - 1].key
      const etapasLog = updateEtapasLog(orden.etapasLog, orden.etapaActual, prevEtapa)

      const updated = await prisma.ordenProduccion.update({
        where: { id: parseInt(id) },
        data: {
          etapaActual: prevEtapa,
          etapasLog,
          estado: currentIdx - 1 === 0 ? 'Pendiente' : 'En Proceso',
        },
      })

      return NextResponse.json(updated)
    }

    // ── Complete order (from QC Final) ──
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
        return NextResponse.json({ error: 'Debe completar el checklist de QC Final' }, { status: 400 })
      }

      // Close QC Final in log
      let log: EtapaLog[] = []
      try { log = orden.etapasLog ? JSON.parse(orden.etapasLog) : [] } catch { log = [] }
      const qcEntry = log.find(e => e.etapa === 'QC Final' && !e.fin)
      if (qcEntry) qcEntry.fin = new Date().toISOString()

      const updated = await prisma.ordenProduccion.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'Completada',
          fechaCompletada: new Date(),
          etapasLog: JSON.stringify(log),
        },
      })

      await prisma.itemProduccion.updateMany({
        where: { ordenId: parseInt(id) },
        data: { completado: true },
      })

      return NextResponse.json(updated)
    }

    // ── Update piece progress (canteo/mecanizado checkboxes) ──
    if (body._progresoPiezas !== undefined) {
      const updated = await prisma.ordenProduccion.update({
        where: { id: parseInt(id) },
        data: { progresoPiezas: JSON.stringify(body._progresoPiezas) },
      })
      return NextResponse.json(updated)
    }

    // ── General update ──
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
        ...(body.notasQCProceso !== undefined && { notasQCProceso: body.notasQCProceso }),
        ...(body.notasQCFinal !== undefined && { notasQCFinal: body.notasQCFinal }),
        ...(body.estado === 'Completada' && { fechaCompletada: new Date() }),
      },
    })

    return NextResponse.json(orden)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar orden' }, { status: 500 })
  }
})

export const DELETE = withPermiso('produccion', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params

  try {
    await prisma.ordenProduccion.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar orden' }, { status: 500 })
  }
})
