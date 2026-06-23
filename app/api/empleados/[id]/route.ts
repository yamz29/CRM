import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

function esAdmin(req: NextRequest) {
  return req.headers.get('x-user-rol') === 'Admin'
}

export const GET = withPermiso('empleados', 'ver', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const empleado = await prisma.empleado.findUnique({
      where: { id },
      include: { solicitudes: { orderBy: { fechaInicio: 'desc' } } },
    })
    if (!empleado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    if (!esAdmin(request)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { salario, ...resto } = empleado
      return NextResponse.json(resto)
    }
    return NextResponse.json(empleado)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener empleado' }, { status: 500 })
  }
})

export const PUT = withPermiso('empleados', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const admin = esAdmin(request)

    const data: Record<string, unknown> = {
      nombre: body.nombre,
      cedula: body.cedula || null,
      telefono: body.telefono || null,
      correo: body.correo || null,
      cargo: body.cargo || null,
      departamento: body.departamento || null,
      fechaIngreso: new Date(body.fechaIngreso),
      fechaSalida: body.fechaSalida ? new Date(body.fechaSalida) : null,
      activo: body.activo !== false,
      horaEntrada: body.horaEntrada !== undefined && body.horaEntrada !== '' ? parseFloat(body.horaEntrada) : null,
      horaSalida: body.horaSalida !== undefined && body.horaSalida !== '' ? parseFloat(body.horaSalida) : null,
      horasPorDia: body.horasPorDia !== undefined && body.horasPorDia !== '' ? parseFloat(body.horasPorDia) : 8,
      diasLaborables: body.diasLaborables || null,
      diasVacacionesAnual: body.diasVacacionesAnual !== undefined ? parseFloat(body.diasVacacionesAnual) || 14 : 14,
      banco: body.banco || null,
      tipoCuenta: body.tipoCuenta || null,
      numeroCuenta: body.numeroCuenta || null,
      observaciones: body.observaciones || null,
    }

    // El salario solo lo puede ver/editar un Admin; otros roles no lo tocan
    if (admin && body.salario !== undefined) {
      data.salario = body.salario === '' || body.salario === null ? null : parseFloat(body.salario)
    }

    const empleado = await prisma.empleado.update({ where: { id }, data })

    if (!admin) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { salario, ...resto } = empleado
      return NextResponse.json(resto)
    }
    return NextResponse.json(empleado)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 })
  }
})

export const DELETE = withPermiso('empleados', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.empleado.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar empleado' }, { status: 500 })
  }
})
