import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

function esAdmin(req: NextRequest) {
  return req.headers.get('x-user-rol') === 'Admin'
}

// Oculta el salario a usuarios sin rol Admin (campo sensible)
function ocultarSalario<T extends { salario: number | null }>(req: NextRequest, empleados: T[]) {
  if (esAdmin(req)) return empleados
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return empleados.map(({ salario, ...resto }) => resto)
}

export const GET = withPermiso('empleados', 'ver', async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const activo = searchParams.get('activo')

  try {
    const empleados = await prisma.empleado.findMany({
      where: activo !== null ? { activo: activo !== 'false' } : {},
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(ocultarSalario(request, empleados))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener empleados' }, { status: 500 })
  }
})

export const POST = withPermiso('empleados', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    if (!body.nombre || !body.fechaIngreso) {
      return NextResponse.json({ error: 'Nombre y fecha de ingreso son obligatorios' }, { status: 400 })
    }

    const empleado = await prisma.empleado.create({
      data: {
        nombre: body.nombre,
        cedula: body.cedula || null,
        telefono: body.telefono || null,
        correo: body.correo || null,
        cargo: body.cargo || null,
        departamento: body.departamento || null,
        fechaIngreso: new Date(body.fechaIngreso),
        fechaSalida: body.fechaSalida ? new Date(body.fechaSalida) : null,
        activo: body.activo !== false,
        salario: esAdmin(request) ? (parseFloat(body.salario) || null) : null,
        horaEntrada: body.horaEntrada !== undefined && body.horaEntrada !== '' ? parseFloat(body.horaEntrada) : null,
        horaSalida: body.horaSalida !== undefined && body.horaSalida !== '' ? parseFloat(body.horaSalida) : null,
        horasPorDia: body.horasPorDia !== undefined && body.horasPorDia !== '' ? parseFloat(body.horasPorDia) : 8,
        diasLaborables: body.diasLaborables || null,
        diasVacacionesAnual: body.diasVacacionesAnual !== undefined ? parseFloat(body.diasVacacionesAnual) || 14 : 14,
        banco: body.banco || null,
        tipoCuenta: body.tipoCuenta || null,
        numeroCuenta: body.numeroCuenta || null,
        observaciones: body.observaciones || null,
      },
    })

    const [resultado] = ocultarSalario(request, [empleado])
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 })
  }
})
