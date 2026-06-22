import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { getTasaAfp, getTasaSfs } from '@/lib/configuracion'

export const GET = withPermiso('nomina', 'ver', async (_req: NextRequest) => {
  try {
    const periodos = await prisma.periodoNomina.findMany({
      orderBy: { fechaInicio: 'desc' },
      include: { _count: { select: { lineas: true } } },
    })
    return NextResponse.json(periodos)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener períodos' }, { status: 500 })
  }
})

// Crea un período y genera automáticamente una línea por cada empleado activo
// con salario asignado. Las horas extra/bonificaciones se editan después, por línea.
export const POST = withPermiso('nomina', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    if (!body.fechaInicio || !body.fechaFin) {
      return NextResponse.json({ error: 'Fecha de inicio y fin son obligatorias' }, { status: 400 })
    }

    const [tasaAfp, tasaSfs] = await Promise.all([getTasaAfp(), getTasaSfs()])

    const empleados = await prisma.empleado.findMany({
      where: { activo: true, salario: { not: null } },
    })

    const periodo = await prisma.periodoNomina.create({
      data: {
        fechaInicio: new Date(body.fechaInicio),
        fechaFin: new Date(body.fechaFin),
        lineas: {
          create: empleados.map((emp) => {
            const salarioBase = (emp.salario ?? 0) / 2
            const afp = Number((salarioBase * (tasaAfp / 100)).toFixed(2))
            const sfs = Number((salarioBase * (tasaSfs / 100)).toFixed(2))
            const totalNeto = Number((salarioBase - afp - sfs).toFixed(2))
            return {
              empleadoId: emp.id,
              salarioBase,
              afp,
              sfs,
              totalBruto: salarioBase,
              totalNeto,
            }
          }),
        },
      },
      include: { lineas: true },
    })

    return NextResponse.json(periodo, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al crear período' }, { status: 500 })
  }
})
