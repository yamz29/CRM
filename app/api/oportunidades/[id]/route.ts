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
