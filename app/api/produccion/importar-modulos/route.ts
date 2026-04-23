import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

// Returns available modules from a presupuesto for import selection
export const POST = withPermiso('produccion', 'editar', async (req: NextRequest) => {
  const { presupuestoId } = await req.json()

  if (!presupuestoId) {
    return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })
  }

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: parseInt(presupuestoId) },
    select: {
      id: true,
      numero: true,
      estado: true,
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
    },
  })

  if (!presupuesto) {
    return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
  }

  const modulos = await prisma.moduloMelaminaV2.findMany({
    where: { presupuestoId: parseInt(presupuestoId) },
    include: {
      piezas: { select: { id: true, nombre: true, largo: true, ancho: true, cantidad: true } },
      materialesModulo: {
        include: { material: { select: { id: true, nombre: true, tipo: true, precio: true } } },
      },
      materialTablero: { select: { id: true, nombre: true, tipo: true, precio: true } },
    },
    orderBy: { nombre: 'asc' },
  })

  return NextResponse.json({ presupuesto, modulos })
})
