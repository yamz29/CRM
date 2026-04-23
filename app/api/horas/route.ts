import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('horas', 'ver', async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const usuarioId  = searchParams.get('usuarioId')
    const proyectoId = searchParams.get('proyectoId')

    const where: Record<string, unknown> = {}

    if (fechaDesde || fechaHasta) {
      const rango: Record<string, Date> = {}
      if (fechaDesde) rango.gte = new Date(fechaDesde)
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        rango.lte = hasta
      }
      where.fecha = rango
    }
    if (usuarioId)  where.usuarioId  = parseInt(usuarioId)
    if (proyectoId) where.proyectoId = parseInt(proyectoId)

    const registros = await prisma.registroHoras.findMany({
      where,
      include: {
        usuario:  { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        cliente:  { select: { id: true, nombre: true } },
      },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
    })

    return NextResponse.json(registros)
  } catch (error) {
    console.error('Error fetching registros de horas:', error)
    return NextResponse.json({ error: 'Error al obtener registros' }, { status: 500 })
  }
})

export const POST = withPermiso('horas', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { usuarioId, fecha, horas, tipoActividad, proyectoId, clienteId, nota, horaInicio } = body

    const TIPOS_COMERCIAL = ['Prospección', 'Levantamiento', 'Cotización']

    if (!tipoActividad) {
      return NextResponse.json({ error: 'El tipo de actividad es requerido' }, { status: 400 })
    }
    const horasVal = parseFloat(String(horas ?? 0))
    if (!horasVal || horasVal <= 0) {
      return NextResponse.json({ error: 'Las horas deben ser mayor a 0' }, { status: 400 })
    }
    if (tipoActividad === 'Proyecto' && !proyectoId) {
      return NextResponse.json({ error: 'Debe seleccionar un proyecto' }, { status: 400 })
    }

    const registro = await prisma.registroHoras.create({
      data: {
        usuarioId:     usuarioId  ? parseInt(String(usuarioId))  : null,
        proyectoId:    tipoActividad === 'Proyecto' && proyectoId
                         ? parseInt(String(proyectoId)) : null,
        clienteId:     TIPOS_COMERCIAL.includes(tipoActividad) && clienteId
                         ? parseInt(String(clienteId)) : null,
        fecha:         fecha ? new Date(fecha) : new Date(),
        horas:         Math.max(0.25, horasVal),
        tipoActividad,
        nota:          nota?.trim() || null,
        horaInicio:    horaInicio != null ? parseFloat(String(horaInicio)) : null,
      },
      include: {
        usuario:  { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        cliente:  { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(registro, { status: 201 })
  } catch (error) {
    console.error('Error creating registro de horas:', error)
    return NextResponse.json({ error: 'Error al crear registro' }, { status: 500 })
  }
})
