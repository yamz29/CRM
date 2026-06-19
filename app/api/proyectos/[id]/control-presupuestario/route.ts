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

  // Adicionales aprobados/facturados: amplían el presupuesto vigente del control
  // (misma convención que lib/resumen-financiero.ts). No tienen partida, así que
  // se muestran como un capítulo sintético propio (ver más abajo).
  const adicionales = await prisma.adicionalProyecto.findMany({
    where: { proyectoId, estado: { in: ['aprobado', 'facturado'] } },
    select: { id: true, numero: true, titulo: true, monto: true },
    orderBy: { id: 'asc' },
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
        esAdicional: false,
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
      esAdicional: false,
    }
  })

  // Capítulo sintético con los adicionales aprobados/facturados. IDs negativos
  // para no colisionar con capítulos/partidas reales; `esAdicional` indica al
  // frontend que estas filas no son partidas editables/fusionables.
  if (adicionales.length > 0) {
    const partidasAdic = adicionales.map(a => ({
      id: -a.id,
      codigo: a.numero,
      descripcion: a.titulo,
      unidad: 'GLB',
      cantidad: 1,
      precioUnitario: a.monto,
      subtotalPresupuestado: a.monto,
      gastoReal: 0,
      diferencia: a.monto,
      pctConsumido: 0,
      estado: 'sin_gasto' as const,
      esAdicional: true,
    }))
    const totalAdic = partidasAdic.reduce((s, p) => s + p.subtotalPresupuestado, 0)
    capitulosData.push({
      id: -1,
      nombre: 'Adicionales aprobados',
      orden: 9999,
      partidas: partidasAdic,
      totalPresupuestado: totalAdic,
      totalGastoReal: 0,
      diferencia: totalAdic,
      pctConsumido: 0,
      esAdicional: true,
    })
  }

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
