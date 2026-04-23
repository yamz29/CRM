import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalcValorOportunidad } from '@/lib/oportunidad-valor'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withPermiso('presupuestos', 'editar', async (request: NextRequest, { params }: Ctx) => {
  try {
    const { id: idStr } = await params
    const id = parseInt(idStr)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { estado } = body

    const estadosValidos = ['Borrador', 'Enviado', 'Aprobado', 'Rechazado']
    if (!estadosValidos.includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const presupuesto = await prisma.presupuesto.update({
      where: { id },
      data: { estado },
    })

    // Auto-activate project when budget is approved
    if (estado === 'Aprobado' && presupuesto.proyectoId) {
      await prisma.proyecto.update({
        where: { id: presupuesto.proyectoId },
        data: { estado: 'En Ejecución' },
      })
    }

    // Recalcular valor de oportunidad vinculada
    if (presupuesto.oportunidadId) {
      await recalcValorOportunidad(presupuesto.oportunidadId)
    }

    return NextResponse.json(presupuesto)
  } catch (error) {
    console.error('Error updating presupuesto estado:', error)
    return NextResponse.json(
      { error: 'Error al actualizar estado' },
      { status: 500 }
    )
  }
})
