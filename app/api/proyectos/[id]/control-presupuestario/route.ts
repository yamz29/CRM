import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // Load capitulos + partidas
  const capitulos = await prisma.proyectoCapitulo.findMany({
    where: { proyectoId },
    orderBy: { orden: 'asc' },
    include: {
      partidas: { orderBy: { orden: 'asc' } },
    },
  })

  // Load all active gastos for this project with their partida link
  const gastos = await prisma.gastoProyecto.findMany({
    where: { proyectoId, estado: { not: 'Anulado' } },
    select: { id: true, monto: true, partidaId: true, descripcion: true, fecha: true, tipoGasto: true },
  })

  // Sum gastos per partida
  const gastosPorPartida = new Map<number, number>()
  let gastosNoClasificados = 0
  for (const g of gastos) {
    if (g.partidaId) {
      gastosPorPartida.set(g.partidaId, (gastosPorPartida.get(g.partidaId) ?? 0) + g.monto)
    } else {
      gastosNoClasificados += g.monto
    }
  }

  // Build comparison by capitulo
  const capitulosData = capitulos.map(cap => {
    const partidasData = cap.partidas.map(p => {
      const gastoReal = gastosPorPartida.get(p.id) ?? 0
      const diferencia = p.subtotalPresupuestado - gastoReal
      const pctConsumido = p.subtotalPresupuestado > 0
        ? Math.round((gastoReal / p.subtotalPresupuestado) * 10000) / 100
        : gastoReal > 0 ? 999 : 0
      return {
        id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        subtotalPresupuestado: p.subtotalPresupuestado,
        gastoReal,
        diferencia,
        pctConsumido,
        estado: pctConsumido === 0 ? 'sin_gasto'
          : pctConsumido >= 100 ? 'excedido'
          : pctConsumido >= 80 ? 'alerta'
          : 'normal',
      }
    })

    const totalPresupuestadoCap = partidasData.reduce((s, p) => s + p.subtotalPresupuestado, 0)
    const totalGastoRealCap = partidasData.reduce((s, p) => s + p.gastoReal, 0)

    return {
      id: cap.id,
      nombre: cap.nombre,
      orden: cap.orden,
      partidas: partidasData,
      totalPresupuestado: totalPresupuestadoCap,
      totalGastoReal: totalGastoRealCap,
      diferencia: totalPresupuestadoCap - totalGastoRealCap,
      pctConsumido: totalPresupuestadoCap > 0
        ? Math.round((totalGastoRealCap / totalPresupuestadoCap) * 10000) / 100
        : 0,
    }
  })

  const totalPresupuestado = capitulosData.reduce((s, c) => s + c.totalPresupuestado, 0)
  const totalGastoReal = capitulosData.reduce((s, c) => s + c.totalGastoReal, 0)
  const totalGastos = gastos.length

  return NextResponse.json({
    capitulos: capitulosData,
    resumen: {
      totalPresupuestado,
      totalGastoReal,
      diferencia: totalPresupuestado - totalGastoReal,
      pctConsumido: totalPresupuestado > 0
        ? Math.round((totalGastoReal / totalPresupuestado) * 10000) / 100
        : 0,
      gastosNoClasificados,
      totalGastos,
      cantidadCapitulos: capitulosData.length,
      cantidadPartidas: capitulosData.reduce((s, c) => s + c.partidas.length, 0),
    },
  })
})
