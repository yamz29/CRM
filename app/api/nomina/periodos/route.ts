import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler } from '@/lib/api-handler'
import { PeriodoNominaCreateSchema } from '@/lib/api-schemas'
import { getTasaAfp, getTasaSfs } from '@/lib/configuracion'

export const GET = apiHandler({ modulo: 'nomina', nivel: 'ver' }, async () => {
  const periodos = await prisma.periodoNomina.findMany({
    orderBy: { fechaInicio: 'desc' },
    include: { _count: { select: { lineas: true } } },
  })
  return NextResponse.json(periodos)
})

// Crea un período y genera automáticamente una línea por cada empleado activo
// con salario asignado. Las horas extra/bonificaciones se editan después, por línea.
export const POST = apiHandler(
  { modulo: 'nomina', nivel: 'editar', schema: PeriodoNominaCreateSchema },
  async (_req, ctx) => {
    const [tasaAfp, tasaSfs] = await Promise.all([getTasaAfp(), getTasaSfs()])

    const empleados = await prisma.empleado.findMany({
      where: { activo: true, salario: { not: null } },
    })

    const periodo = await prisma.periodoNomina.create({
      data: {
        fechaInicio: ctx.body.fechaInicio,
        fechaFin: ctx.body.fechaFin,
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
  },
)
