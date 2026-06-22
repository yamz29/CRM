import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { getTasaAfp, getTasaSfs, getFactorHoraExtra } from '@/lib/configuracion'

type Ctx = { params: Promise<{ id: string; lineaId: string }> }

// Recalcula horas extra, AFP, SFS y totales de una línea de nómina.
// Tarifa hora = (salario mensual / 23.83 días) / horas por día (divisor estándar RD).
export const PUT = withPermiso('nomina', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr, lineaId: lineaIdStr } = await params
  const periodoId = parseInt(idStr)
  const lineaId = parseInt(lineaIdStr)
  if (isNaN(periodoId) || isNaN(lineaId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const linea = await prisma.lineaNomina.findUnique({
      where: { id: lineaId },
      include: { empleado: true, periodo: true },
    })
    if (!linea || linea.periodoId !== periodoId) {
      return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    }
    if (linea.periodo.estado !== 'Borrador') {
      return NextResponse.json({ error: 'Solo se pueden editar líneas de un período en Borrador' }, { status: 400 })
    }

    const body = await request.json()
    const horasExtra = body.horasExtra !== undefined ? parseFloat(body.horasExtra) || 0 : linea.horasExtra
    const bonificaciones = body.bonificaciones !== undefined ? parseFloat(body.bonificaciones) || 0 : linea.bonificaciones
    const otrosDescuentos = body.otrosDescuentos !== undefined ? parseFloat(body.otrosDescuentos) || 0 : linea.otrosDescuentos
    const motivoDescuento = body.motivoDescuento !== undefined ? (body.motivoDescuento || null) : linea.motivoDescuento

    const [tasaAfp, tasaSfs, factorHoraExtra] = await Promise.all([
      getTasaAfp(), getTasaSfs(), getFactorHoraExtra(),
    ])

    const horasPorDia = linea.empleado.horasPorDia || 8
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
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar línea' }, { status: 500 })
  }
})
