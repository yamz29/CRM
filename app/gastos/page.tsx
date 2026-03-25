import { prisma } from '@/lib/prisma'
import { GastosPageClient } from './GastosPageClient'

export default async function GastosPage() {
  const [gastos, proyectos] = await Promise.all([
    prisma.gastoProyecto.findMany({
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      include: {
        proyecto: { select: { id: true, nombre: true } },
        partida:  { select: { id: true, descripcion: true, codigo: true } },
      },
    }),
    prisma.proyecto.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  const total = gastos.reduce((s, g) => s + g.monto, 0)
  const porDestino: Record<string, number> = {}
  for (const g of gastos) {
    porDestino[g.destinoTipo] = (porDestino[g.destinoTipo] ?? 0) + g.monto
  }

  return (
    <GastosPageClient
      gastosIniciales={gastos as any}
      proyectos={proyectos}
      totalInicial={total}
      porDestinoInicial={porDestino}
    />
  )
}
