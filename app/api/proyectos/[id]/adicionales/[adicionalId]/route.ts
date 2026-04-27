import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'

// PUT /api/proyectos/[id]/adicionales/[adicionalId] — actualizar
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adicionalId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { id: pidStr, adicionalId: aidStr } = await params
  const adicionalId = parseInt(aidStr)
  const proyectoId = parseInt(pidStr)
  if (isNaN(adicionalId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const cerrado = await validarProyectoNoCerrado(isNaN(proyectoId) ? null : proyectoId)
  if (cerrado) return cerrado

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.titulo !== undefined) {
      const titulo = body.titulo?.toString().trim()
      if (!titulo) {
        return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
      }
      data.titulo = titulo
    }
    if (body.numero !== undefined) data.numero = body.numero?.toString().trim() || null
    if (body.descripcion !== undefined) data.descripcion = body.descripcion?.toString().trim() || null
    if (body.notas !== undefined) data.notas = body.notas?.toString().trim() || null
    if (body.aprobadoPor !== undefined) data.aprobadoPor = body.aprobadoPor?.toString().trim() || null
    if (body.motivoRechazo !== undefined) data.motivoRechazo = body.motivoRechazo?.toString().trim() || null
    if (body.archivoUrl !== undefined) data.archivoUrl = body.archivoUrl?.toString().trim() || null

    if (body.monto !== undefined) {
      const monto = parseFloat(body.monto)
      if (isNaN(monto) || monto < 0) {
        return NextResponse.json({ error: 'El monto debe ser un número ≥ 0' }, { status: 400 })
      }
      data.monto = monto
    }

    if (body.estado !== undefined) {
      const validos = ['propuesto', 'aprobado', 'rechazado', 'facturado']
      if (!validos.includes(body.estado)) {
        return NextResponse.json({ error: `Estado inválido. Use: ${validos.join(', ')}` }, { status: 400 })
      }
      data.estado = body.estado
      // Marcar fecha de aprobación cuando pasa a aprobado
      if (body.estado === 'aprobado') {
        const actual = await prisma.adicionalProyecto.findUnique({
          where: { id: adicionalId },
          select: { fechaAprobacion: true },
        })
        if (!actual?.fechaAprobacion) data.fechaAprobacion = new Date()
      }
    }

    const adicional = await prisma.adicionalProyecto.update({
      where: { id: adicionalId },
      data,
    })

    return NextResponse.json(adicional)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar adicional'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/proyectos/[id]/adicionales/[adicionalId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; adicionalId: string }> }
) {
  const denied = await checkPermiso(request, 'proyectos', 'editar')
  if (denied) return denied

  const { id: pidStr, adicionalId: aidStr } = await params
  const adicionalId = parseInt(aidStr)
  const proyectoId = parseInt(pidStr)
  if (isNaN(adicionalId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const cerrado = await validarProyectoNoCerrado(isNaN(proyectoId) ? null : proyectoId)
  if (cerrado) return cerrado

  try {
    await prisma.adicionalProyecto.delete({ where: { id: adicionalId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar adicional'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
