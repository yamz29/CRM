import { prisma } from '@/lib/prisma'

/**
 * Recalcula el valor estimado de una oportunidad basado en sus presupuestos vinculados.
 * Lógica:
 *   - Si hay un presupuesto Aprobado → usa ese total
 *   - Si no, usa el total más alto entre los presupuestos no Rechazados
 *   - Si no hay presupuestos vinculados, NO toca el valor (respeta el valor manual inicial)
 */
export async function recalcValorOportunidad(oportunidadId: number): Promise<void> {
  const presupuestos = await prisma.presupuesto.findMany({
    where: { oportunidadId, estado: { not: 'Rechazado' } },
    select: { total: true, estado: true },
  })
  if (presupuestos.length === 0) return

  const aprobado = presupuestos.find(p => p.estado === 'Aprobado')
  const valor = aprobado
    ? aprobado.total
    : Math.max(...presupuestos.map(p => p.total))

  await prisma.oportunidad.update({
    where: { id: oportunidadId },
    data: { valor },
  })
}
