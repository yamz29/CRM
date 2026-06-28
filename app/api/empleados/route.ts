import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

function esAdmin(req: NextRequest) {
  return req.headers.get('x-user-rol') === 'Admin'
}

// Oculta el salario a usuarios sin rol Admin (campo sensible)
function ocultarSalario<T extends { salario: number | null }>(req: NextRequest, empleados: T[]) {
  if (esAdmin(req)) return empleados
  return empleados.map(({ salario, ...resto }) => resto)
}

type HorarioInput = { dia: string; horaEntrada?: number | string | null; horaSalida?: number | string | null; horasPorDia?: number | string | null }

function buildHorariosCreate(horarios: HorarioInput[] | undefined) {
  if (!Array.isArray(horarios)) return []
  return horarios
    .filter((h) => h && h.dia)
    .map((h) => ({
      dia: h.dia,
      horaEntrada: h.horaEntrada !== undefined && h.horaEntrada !== null && h.horaEntrada !== '' ? parseFloat(String(h.horaEntrada)) : null,
      horaSalida: h.horaSalida !== undefined && h.horaSalida !== null && h.horaSalida !== '' ? parseFloat(String(h.horaSalida)) : null,
      horasPorDia: h.horasPorDia !== undefined && h.horasPorDia !== null && h.horasPorDia !== '' ? parseFloat(String(h.horasPorDia)) || 8 : 8,
    }))
}

export const GET = withPermiso('empleados', 'ver', async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const activo = searchParams.get('activo')

  try {
    const empleados = await prisma.empleado.findMany({
      where: activo !== null ? { activo: activo !== 'false' } : {},
      orderBy: { nombre: 'asc' },
      include: { horarios: true, usuario: { select: { id: true, nombre: true } } },
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
        usuarioId: body.usuarioId !== undefined && body.usuarioId !== '' && body.usuarioId !== null ? parseInt(body.usuarioId) : null,
        diasVacacionesAnual: body.diasVacacionesAnual !== undefined ? parseFloat(body.diasVacacionesAnual) || 14 : 14,
        banco: body.banco || null,
        tipoCuenta: body.tipoCuenta || null,
        numeroCuenta: body.numeroCuenta || null,
        observaciones: body.observaciones || null,
        horarios: { create: buildHorariosCreate(body.horarios) },
      },
      include: { horarios: true },
    })

    const [resultado] = ocultarSalario(request, [empleado])
    return NextResponse.json(resultado, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear empleado' }, { status: 500 })
  }
})
