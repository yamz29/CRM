import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { LineaNominaUpdateSchema } from '@/lib/api-schemas'
import { getTasaAfp, getTasaSfs, getFactorHoraExtra } from '@/lib/configuracion'

// Recalcula horas extra, AFP, SFS y totales de una línea de nómina.
// Tarifa hora = (salario mensual / 23.83 días) / horas por día (divisor estándar RD).
export const PUT = apiHandler(
  { modulo: 'nomina', nivel: 'editar', schema: LineaNominaUpdateSchema },
  async (_req, ctx) => {
    const periodoId = ctx.id
    const lineaId = parseInt(ctx.params.lineaId ?? '', 10)
    if (isNaN(lineaId)) throw new ApiError(400, 'ID inválido')

    const linea = await prisma.lineaNomina.findUnique({
      where: { id: lineaId },
      include: { empleado: { include: { horarios: true } }, periodo: true },
    })
    if (!linea || linea.periodoId !== periodoId) throw new ApiError(404, 'No encontrada')
    if (linea.periodo.estado !== 'Borrador') {
      throw new ApiError(400, 'Solo se pueden editar líneas de un período en Borrador')
    }

    const body = ctx.body
    const horasExtra = body.horasExtra ?? linea.horasExtra
    const bonificaciones = body.bonificaciones ?? linea.bonificaciones
    const otrosDescuentos = body.otrosDescuentos ?? linea.otrosDescuentos
    const motivoDescuento = body.motivoDescuento !== undefined ? body.motivoDescuento : linea.motivoDescuento

    const [tasaAfp, tasaSfs, factorHoraExtra] = await Promise.all([
      getTasaAfp(), getTasaSfs(), getFactorHoraExtra(),
    ])

    const horarios = linea.empleado.horarios
    const horasPorDia = horarios.length > 0
      ? horarios.reduce((sum, h) => sum + h.horasPorDia, 0) / horarios.length
      : 8
    const tarifaHora = ((linea.empleado.salario ?? 0) / 23.83) / horasPorDia
    const valorHoraExtra = Number((horasExtra * tarifaHora * factorHoraExtra).toFixed(2))

    const totalBruto = Number((linea.salarioBase + valorHoraExtra + bonificaciones).toFixed(2))
    const afp = Number((totalBruto * (tasaAfp / 100)).toFixed(2))
    const sfs = Number((totalBruto * (tasaSfs / 100)).toFixed(2))
    const totalNeto = Number((totalBruto - afp - sfs - otrosDescuentos).toFixed(2))

    const actualizada = await prisma.lineaNomina.update({
      where: { id: lineaId },
      data: {
        horasExtra, valorHoraExtra, bonificaciones, otrosDescuentos, motivoDescuento,
        afp, sfs, totalBruto, totalNeto,
      },
    })

    return NextResponse.json(actualizada)
  },
)
