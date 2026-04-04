import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const oportunidad = await prisma.oportunidad.findUnique({
    where: { id: numId },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, correo: true } },
      proyecto: { select: { id: true, nombre: true, estado: true } },
      presupuestos: { select: { id: true, numero: true, estado: true, total: true, createdAt: true } },
      actividades: { orderBy: { fecha: 'desc' } },
    },
  })

  if (!oportunidad) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(oportunidad)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { nombre, etapa, valor, moneda, probabilidad, fechaCierreEst, responsable, motivoPerdida, notas } = body

  // Check if stage is changing to auto-create tasks
  let etapaAnterior: string | null = null
  if (etapa !== undefined) {
    const current = await prisma.oportunidad.findUnique({
      where: { id: numId },
      select: { etapa: true, clienteId: true, responsable: true },
    })
    if (current && current.etapa !== etapa) {
      etapaAnterior = current.etapa

      // Auto-create tasks from templates for the new stage
      if (!['Ganado', 'Perdido'].includes(etapa)) {
        const plantillas = await prisma.plantillaTareaEtapa.findMany({
          where: { etapa, activa: true },
          orderBy: { orden: 'asc' },
        })
        if (plantillas.length > 0) {
          const now = new Date()
          await prisma.tarea.createMany({
            data: plantillas.map(p => ({
              titulo: p.titulo,
              descripcion: p.descripcion,
              prioridad: p.prioridad,
              oportunidadId: numId,
              clienteId: current.clienteId,
              etapaPipeline: etapa,
              responsable: current.responsable || null,
              fechaLimite: p.diasLimite
                ? new Date(now.getTime() + p.diasLimite * 24 * 60 * 60 * 1000)
                : null,
            })),
          })
        }
      }
    }
  }

  const oportunidad = await prisma.oportunidad.update({
    where: { id: numId },
    data: {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(etapa !== undefined ? { etapa } : {}),
      ...(valor !== undefined ? { valor: valor ? parseFloat(valor) : null } : {}),
      ...(moneda !== undefined ? { moneda } : {}),
      ...(probabilidad !== undefined ? { probabilidad: probabilidad !== null ? parseInt(probabilidad) : null } : {}),
      ...(fechaCierreEst !== undefined ? { fechaCierreEst: fechaCierreEst ? new Date(fechaCierreEst) : null } : {}),
      ...(responsable !== undefined ? { responsable: responsable || null } : {}),
      ...(motivoPerdida !== undefined ? { motivoPerdida: motivoPerdida || null } : {}),
      ...(notas !== undefined ? { notas: notas || null } : {}),
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
    },
  })

  return NextResponse.json(oportunidad)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  await prisma.oportunidad.delete({ where: { id: numId } })
  return NextResponse.json({ ok: true })
}
