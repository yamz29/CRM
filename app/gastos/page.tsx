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
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          ✨ <strong>Nuevo:</strong> Ahora puedes ver gastos de proyecto y facturas contables unificados en una sola vista.
        </p>
        <a href="/contabilidad/transacciones" className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline whitespace-nowrap">
          Ir a Transacciones →
        </a>
      </div>
      <GastosPageClient
        gastosIniciales={gastos as any}
        proyectos={proyectos}
        totalInicial={total}
        porDestinoInicial={porDestino}
      />
    </>
  )
}
