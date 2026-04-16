import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // Default: last 6 months
  const now = new Date()
  const fechaDesde = desde ? new Date(desde) : new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const fechaHasta = hasta ? new Date(hasta + 'T23:59:59') : now

  // All opportunities updated within the date range that reached Ganado or Perdido
  const cerradas = await prisma.oportunidad.findMany({
    where: {
      etapa: { in: ['Ganado', 'Perdido'] },
      updatedAt: { gte: fechaDesde, lte: fechaHasta },
    },
    select: {
      id: true,
      nombre: true,
      etapa: true,
      valor: true,
      moneda: true,
      responsable: true,
      motivoPerdida: true,
      categoriaPerdida: true,
      updatedAt: true,
      createdAt: true,
      cliente: { select: { id: true, nombre: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Active pipeline for context
  const activasCount = await prisma.oportunidad.count({
    where: {
      etapa: { notIn: ['Ganado', 'Perdido'] },
      archivada: false,
    },
  })

  const ganadas = cerradas.filter((o: { etapa: string }) => o.etapa === 'Ganado')
  const perdidas = cerradas.filter((o: { etapa: string }) => o.etapa === 'Perdido')

  const valorGanado = ganadas.reduce((s: number, o: { valor: number | null }) => s + (o.valor ?? 0), 0)
  const valorPerdido = perdidas.reduce((s: number, o: { valor: number | null }) => s + (o.valor ?? 0), 0)

  // Group perdidas by motivo (texto libre)
  const motivosMap: Record<string, { count: number; valor: number }> = {}
  for (const p of perdidas) {
    const motivo = (p as { motivoPerdida: string | null }).motivoPerdida || 'Sin motivo especificado'
    if (!motivosMap[motivo]) motivosMap[motivo] = { count: 0, valor: 0 }
    motivosMap[motivo].count++
    motivosMap[motivo].valor += (p as { valor: number | null }).valor ?? 0
  }
  const motivos = Object.entries(motivosMap)
    .map(([motivo, data]) => ({ motivo, ...data }))
    .sort((a, b) => b.count - a.count)

  // Group perdidas by categoria (predefinida)
  const categoriasMap: Record<string, { count: number; valor: number }> = {}
  for (const p of perdidas) {
    const cat = (p as { categoriaPerdida: string | null }).categoriaPerdida || 'Sin categoría'
    if (!categoriasMap[cat]) categoriasMap[cat] = { count: 0, valor: 0 }
    categoriasMap[cat].count++
    categoriasMap[cat].valor += (p as { valor: number | null }).valor ?? 0
  }
  const categorias = Object.entries(categoriasMap)
    .map(([categoria, data]) => ({ categoria, ...data }))
    .sort((a, b) => b.count - a.count)

  // Monthly breakdown for chart
  const mesesMap: Record<string, { ganadas: number; perdidas: number; valorGanado: number; valorPerdido: number }> = {}
  for (const o of cerradas) {
    const d = new Date(o.updatedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!mesesMap[key]) mesesMap[key] = { ganadas: 0, perdidas: 0, valorGanado: 0, valorPerdido: 0 }
    if (o.etapa === 'Ganado') {
      mesesMap[key].ganadas++
      mesesMap[key].valorGanado += o.valor ?? 0
    } else {
      mesesMap[key].perdidas++
      mesesMap[key].valorPerdido += o.valor ?? 0
    }
  }
  const meses = Object.entries(mesesMap)
    .map(([mes, data]) => ({ mes, ...data }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  // By responsable
  const respMap: Record<string, { ganadas: number; perdidas: number; valorGanado: number }> = {}
  for (const o of cerradas) {
    const resp = o.responsable || 'Sin asignar'
    if (!respMap[resp]) respMap[resp] = { ganadas: 0, perdidas: 0, valorGanado: 0 }
    if (o.etapa === 'Ganado') {
      respMap[resp].ganadas++
      respMap[resp].valorGanado += o.valor ?? 0
    } else {
      respMap[resp].perdidas++
    }
  }
  const porResponsable = Object.entries(respMap)
    .map(([responsable, data]) => ({
      responsable,
      ...data,
      tasa: data.ganadas + data.perdidas > 0
        ? Math.round((data.ganadas / (data.ganadas + data.perdidas)) * 100)
        : 0,
    }))
    .sort((a, b) => b.valorGanado - a.valorGanado)

  // Cycle time: days from creation to close
  const cycleTimes = cerradas.map(o => {
    const created = new Date(o.createdAt).getTime()
    const closed = new Date(o.updatedAt).getTime()
    return Math.max(Math.floor((closed - created) / (1000 * 60 * 60 * 24)), 0)
  })
  const avgCycleTime = cycleTimes.length > 0
    ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
    : 0

  return NextResponse.json({
    periodo: { desde: fechaDesde.toISOString(), hasta: fechaHasta.toISOString() },
    resumen: {
      totalCerradas: cerradas.length,
      ganadas: ganadas.length,
      perdidas: perdidas.length,
      tasaCierre: cerradas.length > 0 ? Math.round((ganadas.length / cerradas.length) * 100) : 0,
      valorGanado,
      valorPerdido,
      activasEnPipeline: activasCount,
      cicloPromedioDias: avgCycleTime,
    },
    detalle: cerradas.map(o => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    })),
    motivos,
    categorias,
    meses,
    porResponsable,
  })
}
