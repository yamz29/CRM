import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OportunidadSchema, zodError } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const etapa     = searchParams.get('etapa')
  const clienteId = searchParams.get('clienteId')

  const oportunidades = await prisma.oportunidad.findMany({
    where: {
      ...(etapa     ? { etapa } : {}),
      ...(clienteId ? { clienteId: parseInt(clienteId) } : {}),
    },
    include: {
      cliente:      { select: { id: true, nombre: true } },
      proyecto:     { select: { id: true, nombre: true } },
      presupuestos: { select: { id: true, numero: true, estado: true, total: true } },
      _count:       { select: { actividades: true, tareas: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(oportunidades)
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const parsed = OportunidadSchema.safeParse(body)
    if (!parsed.success) return zodError(parsed.error)

    const {
      clienteId, nombre, etapa, valor, moneda,
      probabilidad, fechaCierreEst, responsable, notas, presupuestoIds,
    } = parsed.data

    const oportunidad = await prisma.oportunidad.create({
      data: {
        clienteId,
        nombre,
        etapa:          etapa ?? 'Lead',
        valor:          valor ?? null,
        moneda:         moneda ?? 'DOP',
        probabilidad:   probabilidad ?? null,
        fechaCierreEst: fechaCierreEst ? new Date(fechaCierreEst) : null,
        responsable:    responsable ?? null,
        notas:          notas ?? null,
      },
      include: { cliente: { select: { id: true, nombre: true } } },
    })

    if (presupuestoIds && presupuestoIds.length > 0) {
      await prisma.presupuesto.updateMany({
        where: { id: { in: presupuestoIds } },
        data:  { oportunidadId: oportunidad.id },
      })
    }

    return NextResponse.json(oportunidad, { status: 201 })
  } catch (error) {
    console.error('Error creating oportunidad:', error)
    return NextResponse.json({ error: 'Error al crear oportunidad' }, { status: 500 })
  }
}
