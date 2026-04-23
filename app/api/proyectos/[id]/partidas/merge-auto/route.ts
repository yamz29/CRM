import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

/**
 * GET: devuelve un preview de los grupos de partidas que se pueden fusionar por código.
 * Solo grupos con 2+ partidas que comparten el mismo código (no null).
 */
export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const partidas = await prisma.proyectoPartida.findMany({
    where: { proyectoId, codigo: { not: null } },
    orderBy: { orden: 'asc' },
  })

  const grupos = new Map<string, typeof partidas>()
  for (const p of partidas) {
    const key = p.codigo!.trim().toLowerCase()
    if (!key) continue
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(p)
  }

  const candidatos = Array.from(grupos.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([codigo, arr]) => ({
      codigo: arr[0].codigo,
      cantidad: arr.length,
      totalSubtotal: arr.reduce((s, p) => s + p.subtotalPresupuestado, 0),
      partidas: arr.map(p => ({
        id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        subtotalPresupuestado: p.subtotalPresupuestado,
        cantidad: p.cantidad,
        unidad: p.unidad,
      })),
    }))

  return NextResponse.json({ grupos: candidatos })
})

/**
 * POST: fusiona todas las partidas que comparten el mismo código.
 * Body (opcional): { codigos?: string[] } — si se omite, fusiona todos los grupos con duplicados.
 * Toma como destino la primera partida de cada grupo (menor orden).
 */
export const POST = withPermiso('proyectos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const codigosFiltro: string[] | undefined = Array.isArray(body?.codigos) ? body.codigos : undefined

  const partidas = await prisma.proyectoPartida.findMany({
    where: { proyectoId, codigo: { not: null } },
    orderBy: { orden: 'asc' },
  })

  // Agrupar por código (normalizado)
  const grupos = new Map<string, typeof partidas>()
  for (const p of partidas) {
    const key = p.codigo!.trim().toLowerCase()
    if (!key) continue
    if (codigosFiltro && !codigosFiltro.map(c => c.trim().toLowerCase()).includes(key)) continue
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(p)
  }

  let totalFusionadas = 0
  let totalGastos = 0
  const gruposFusionados: { codigo: string; fusionadas: number }[] = []

  await prisma.$transaction(async (tx) => {
    for (const [, arr] of grupos) {
      if (arr.length < 2) continue
      const [target, ...sources] = arr
      const totalSubtotal = arr.reduce((s, p) => s + p.subtotalPresupuestado, 0)
      const totalCantidad = arr.reduce((s, p) => s + p.cantidad, 0)
      const precioUnitario = totalCantidad > 0 ? totalSubtotal / totalCantidad : target.precioUnitario

      const g = await tx.gastoProyecto.updateMany({
        where: { partidaId: { in: sources.map(s => s.id) } },
        data: { partidaId: target.id },
      })

      await tx.proyectoPartida.update({
        where: { id: target.id },
        data: {
          subtotalPresupuestado: totalSubtotal,
          cantidad: totalCantidad,
          precioUnitario,
        },
      })

      await tx.proyectoPartida.deleteMany({
        where: { id: { in: sources.map(s => s.id) } },
      })

      totalFusionadas += sources.length
      totalGastos += g.count
      gruposFusionados.push({ codigo: target.codigo ?? '', fusionadas: sources.length })
    }
  })

  return NextResponse.json({
    ok: true,
    gruposFusionados,
    totalFusionadas,
    gastosReasignados: totalGastos,
  })
})
