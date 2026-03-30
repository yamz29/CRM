import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const etapa = searchParams.get('etapa')
  const clienteId = searchParams.get('clienteId')

  const oportunidades = await prisma.oportunidad.findMany({
    where: {
      ...(etapa ? { etapa } : {}),
      ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
      presupuestos: { select: { id: true, numero: true, estado: true, total: true } },
      _count: { select: { actividades: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(oportunidades)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clienteId, nombre, etapa, valor, moneda, probabilidad, fechaCierreEst, responsable, notas, presupuestoIds } = body

  if (!clienteId || !nombre) {
    return NextResponse.json({ error: 'clienteId y nombre son requeridos' }, { status: 400 })
  }

  const oportunidad = await prisma.oportunidad.create({
    data: {
      clienteId: parseInt(clienteId),
      nombre,
      etapa: etapa ?? 'Lead',
      valor: valor ? parseFloat(valor) : null,
      moneda: moneda ?? 'DOP',
      probabilidad: probabilidad ? parseInt(probabilidad) : null,
      fechaCierreEst: fechaCierreEst ? new Date(fechaCierreEst) : null,
      responsable: responsable ?? null,
      notas: notas ?? null,
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
    },
  })

  // Vincular presupuestos existentes si se proporcionaron
  if (presupuestoIds && Array.isArray(presupuestoIds) && presupuestoIds.length > 0) {
    await prisma.presupuesto.updateMany({
      where: { id: { in: presupuestoIds.map((id: number | string) => parseInt(String(id))) } },
      data: { oportunidadId: oportunidad.id },
    })
  }

  return NextResponse.json(oportunidad, { status: 201 })
}
