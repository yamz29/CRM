import { prisma } from '@/lib/prisma'
import { FinanzasNav } from '@/components/contabilidad/FinanzasNav'
import { RutasCompraPageClient } from './RutasCompraPageClient'

export default async function RutasCompraPage() {
  const rutas = await prisma.rutaCompra.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: { select: { proveedorId: true, proveedorTexto: true, precioEstimado: true, precioReal: true } },
    },
  })

  const data = rutas.map((r) => {
    const paradas = new Set(
      r.items.map((i) => (i.proveedorId ? `id:${i.proveedorId}` : i.proveedorTexto ? `t:${i.proveedorTexto}` : 'sin'))
    )
    return {
      id: r.id,
      codigo: r.codigo,
      titulo: r.titulo,
      fecha: r.fecha.toISOString(),
      estado: r.estado,
      comprador: r.comprador,
      numParadas: paradas.size,
      numItems: r.items.length,
      totalEstimado: r.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0),
      totalReal: r.items.reduce((s, i) => s + (i.precioReal ?? 0), 0),
    }
  })

  return (
    <div className="space-y-4">
      <FinanzasNav activo="rutas" />
      <RutasCompraPageClient rutasIniciales={data} />
    </div>
  )
}
