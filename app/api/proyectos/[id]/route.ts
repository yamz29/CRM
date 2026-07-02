import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { ProyectoUpdateSchema } from '@/lib/api-schemas'

// Notifica el cambio de estado por push sin bloquear la respuesta si falla.
async function notificarCambioEstado(id: number, nombre: string, de: string, a: string) {
  try {
    const { enviarNotificacionAInteresados } = await import('@/lib/push')
    await enviarNotificacionAInteresados({
      title: `Proyecto: ${nombre}`,
      body: `Cambió de "${de}" → "${a}"`,
      url: `/proyectos/${id}`,
      tag: `proyecto-${id}-estado`,
    })
  } catch (e) {
    console.error('[notif] error notificando cambio de estado:', e)
  }
}

export const GET = apiHandler({ modulo: 'proyectos', nivel: 'ver' }, async (_req, ctx) => {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: ctx.id },
    include: {
      cliente: true,
      presupuestos: {
        include: {
          _count: { select: { partidas: true, modulosMelamina: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!proyecto) throw new ApiError(404, 'Proyecto no encontrado')

  return NextResponse.json(proyecto)
})

export const PUT = apiHandler({ modulo: 'proyectos', nivel: 'editar' }, async (request, ctx) => {
  const id = ctx.id
  const body = await request.json()

  // Acción rápida: archivar/desarchivar (no requiere todos los campos)
  if (body._archivar !== undefined) {
    const proyecto = await prisma.proyecto.update({
      where: { id },
      data: {
        archivada: !!body._archivar,
        fechaArchivada: body._archivar ? new Date() : null,
      },
    })
    return NextResponse.json(proyecto)
  }

  // Patch parcial: solo actualiza los campos enviados (ej: avanceFisico)
  if (body._patch === true) {
    const data: Record<string, unknown> = {}
    if (body.avanceFisico != null) data.avanceFisico = parseInt(String(body.avanceFisico))
    if (body.estado !== undefined) {
      data.estado = body.estado
      // Si pasa a Pausado, setear fechaPausa si aún no existe
      if (body.estado === 'Pausado') data.fechaPausa = new Date()
      if (body.razonPausa !== undefined) data.razonPausa = body.razonPausa || null
    }
    if (body.responsable !== undefined) data.responsable = body.responsable || null
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'Sin cambios')
    }

    // Capturar estado anterior para notificar si cambió
    const previo = body.estado !== undefined
      ? await prisma.proyecto.findUnique({ where: { id }, select: { estado: true, nombre: true } })
      : null

    const proyecto = await prisma.proyecto.update({ where: { id }, data })

    if (previo && body.estado && previo.estado !== body.estado) {
      await notificarCambioEstado(id, previo.nombre, previo.estado, body.estado)
    }

    return NextResponse.json(proyecto)
  }

  // Update completo — validado con Zod (el ZodError lo traduce apiHandler a 400)
  const datos = ProyectoUpdateSchema.parse(body)

  // Detectar transición a / desde Pausado para actualizar fechaPausa y razón
  const existing = await prisma.proyecto.findUnique({
    where: { id },
    select: { estado: true, fechaPausa: true },
  })
  const nuevoEstado = datos.estado
  const entrandoAPausa = nuevoEstado === 'Pausado' && existing?.estado !== 'Pausado'
  const saliendoDePausa = nuevoEstado !== 'Pausado' && existing?.estado === 'Pausado'

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: {
      nombre: datos.nombre,
      clienteId: datos.clienteId,
      tipoProyecto: datos.tipoProyecto,
      ubicacion: datos.ubicacion ?? null,
      fechaInicio: datos.fechaInicio ?? null,
      fechaEstimada: datos.fechaEstimada ?? null,
      estado: nuevoEstado,
      descripcion: datos.descripcion ?? null,
      responsable: datos.responsable ?? null,
      presupuestoEstimado: datos.presupuestoEstimado,
      avanceFisico: datos.avanceFisico,
      razonPausa: nuevoEstado === 'Pausado' ? (datos.razonPausa ?? null) : null,
      fechaPausa: entrandoAPausa ? new Date() : saliendoDePausa ? null : undefined,
    },
  })

  // Notificación push si cambió el estado (trigger inmediato).
  if (existing?.estado && existing.estado !== nuevoEstado) {
    await notificarCambioEstado(id, proyecto.nombre, existing.estado, nuevoEstado)
  }

  // Auto-crear cronograma si el proyecto pasa a Adjudicado o En Ejecución
  // y aún no tiene ninguno. Sólo un cronograma por proyecto (v1).
  const estadosConCronograma = ['Adjudicado', 'En Ejecución']
  if (estadosConCronograma.includes(nuevoEstado) && existing?.estado !== nuevoEstado) {
    const cronogramaExistente = await prisma.cronograma.findFirst({
      where: { proyectoId: id },
      select: { id: true },
    })
    if (!cronogramaExistente) {
      await prisma.cronograma.create({
        data: {
          nombre: `Cronograma — ${proyecto.nombre}`,
          proyectoId: id,
          fechaInicio: proyecto.fechaInicio ?? new Date(),
          estado: 'Planificado',
          usarCalendarioLaboral: true,
          usarFeriados: false,
        },
      })
    }
  }

  return NextResponse.json(proyecto)
})

export const DELETE = apiHandler({ modulo: 'proyectos', nivel: 'editar' }, async (_req, ctx) => {
  // Si el proyecto tiene registros relacionados (gastos, facturas, cronogramas…),
  // Prisma lanza P2003 y apiHandler lo traduce a 409 con mensaje de dominio.
  await prisma.proyecto.delete({ where: { id: ctx.id } })

  return NextResponse.json({ message: 'Proyecto eliminado correctamente' })
})
