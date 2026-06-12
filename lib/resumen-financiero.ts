import { prisma } from './prisma'

export interface ResumenFinanciero {
  proyectoId: number
  /** Presupuesto vigente: snapshot de control si existe, si no el estimado inicial. Incluye adicionales aprobados/facturados. */
  presupuesto: number
  /** Total de gastos no anulados asignados al proyecto. */
  gastado: number
  /** De dónde sale el presupuesto: 'control' (snapshot poblado) o 'estimado' (presupuestoEstimado). */
  fuente: 'control' | 'estimado'
}

/**
 * Calcula presupuesto-vs-gastado para varios proyectos en 4 queries
 * (sin N+1). Única fuente de verdad: dashboard, reportes y cron de
 * notificaciones deben usar esto en vez de recalcular por su cuenta.
 */
export async function getResumenFinancieroBatch(
  proyectoIds: number[]
): Promise<Map<number, ResumenFinanciero>> {
  if (proyectoIds.length === 0) return new Map()

  const [snapshots, proyectos, adicionales, gastos] = await Promise.all([
    prisma.proyectoPartida.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds } },
      _sum: { subtotalPresupuestado: true },
    }),
    prisma.proyecto.findMany({
      where: { id: { in: proyectoIds } },
      select: { id: true, presupuestoEstimado: true },
    }),
    prisma.adicionalProyecto.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds }, estado: { in: ['aprobado', 'facturado'] } },
      _sum: { monto: true },
    }),
    prisma.gastoProyecto.groupBy({
      by: ['proyectoId'],
      where: { proyectoId: { in: proyectoIds }, estado: { not: 'Anulado' } },
      _sum: { monto: true },
    }),
  ])

  const snapshotPorProyecto = new Map(snapshots.map(s => [s.proyectoId, s._sum.subtotalPresupuestado ?? 0]))
  const adicionalPorProyecto = new Map(adicionales.map(a => [a.proyectoId, a._sum.monto ?? 0]))
  const gastoPorProyecto = new Map(gastos.map(g => [g.proyectoId as number, g._sum.monto ?? 0]))

  const result = new Map<number, ResumenFinanciero>()
  for (const p of proyectos) {
    const snapshot = snapshotPorProyecto.get(p.id) ?? 0
    const adic = adicionalPorProyecto.get(p.id) ?? 0
    const fuente: ResumenFinanciero['fuente'] = snapshot > 0 ? 'control' : 'estimado'
    const base = fuente === 'control' ? snapshot : (p.presupuestoEstimado ?? 0)
    result.set(p.id, {
      proyectoId: p.id,
      presupuesto: base + adic,
      gastado: gastoPorProyecto.get(p.id) ?? 0,
      fuente,
    })
  }
  return result
}
