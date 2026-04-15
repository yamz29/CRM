import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

/**
 * Fusiona varias partidas en una sola (por ID).
 * Body:
 *   { partidaIds: number[], targetPartidaId: number, nuevaDescripcion?: string, nuevoCodigo?: string }
 *
 * Comportamiento:
 *   - Valida que todas pertenezcan al proyecto
 *   - Suma cantidades y subtotales de las partidas fuente a la partida destino
 *   - Reasigna todos los gastos de las fuentes a la partida destino
 *   - Elimina las partidas fuente
 *   - Opcionalmente actualiza descripción/código de la partida destino
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await req.json()
  const { partidaIds, targetPartidaId, nuevaDescripcion, nuevoCodigo } = body

  if (!Array.isArray(partidaIds) || partidaIds.length < 2) {
    return NextResponse.json({ error: 'Se requieren al menos 2 partidas' }, { status: 400 })
  }
  if (!targetPartidaId || !partidaIds.includes(targetPartidaId)) {
    return NextResponse.json({ error: 'targetPartidaId debe estar incluido en partidaIds' }, { status: 400 })
  }

  // Validar que todas pertenecen al proyecto
  const partidas = await prisma.proyectoPartida.findMany({
    where: { id: { in: partidaIds }, proyectoId },
  })
  if (partidas.length !== partidaIds.length) {
    return NextResponse.json({ error: 'Alguna partida no pertenece al proyecto' }, { status: 400 })
  }

  const target = partidas.find(p => p.id === targetPartidaId)
  if (!target) return NextResponse.json({ error: 'Partida destino no encontrada' }, { status: 400 })

  const sources = partidas.filter(p => p.id !== targetPartidaId)

  // Sumatoria de las fuentes
  const totalSubtotal = partidas.reduce((s, p) => s + p.subtotalPresupuestado, 0)
  const totalCantidad = partidas.reduce((s, p) => s + p.cantidad, 0)
  // Precio unitario promedio ponderado (si todas tienen la misma unidad)
  const precioUnitario = totalCantidad > 0 ? totalSubtotal / totalCantidad : target.precioUnitario

  const result = await prisma.$transaction(async (tx) => {
    // Reasignar gastos de las fuentes al target
    const gastosActualizados = await tx.gastoProyecto.updateMany({
      where: { partidaId: { in: sources.map(s => s.id) } },
      data: { partidaId: targetPartidaId },
    })

    // Actualizar el target
    const updated = await tx.proyectoPartida.update({
      where: { id: targetPartidaId },
      data: {
        subtotalPresupuestado: totalSubtotal,
        cantidad: totalCantidad,
        precioUnitario,
        descripcion: nuevaDescripcion?.trim() || target.descripcion,
        codigo: nuevoCodigo !== undefined ? (nuevoCodigo?.trim() || null) : target.codigo,
      },
    })

    // Eliminar las fuentes
    await tx.proyectoPartida.deleteMany({
      where: { id: { in: sources.map(s => s.id) } },
    })

    return { updated, fusionadas: sources.length, gastosReasignados: gastosActualizados.count }
  })

  return NextResponse.json({
    ok: true,
    partida: result.updated,
    fusionadas: result.fusionadas,
    gastosReasignados: result.gastosReasignados,
  })
}
