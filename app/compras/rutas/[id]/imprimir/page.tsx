import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PrintButton } from './PrintButton'

interface ItemImpr {
  id: number
  descripcion: string
  cantidad: number
  unidad: string
  urgencia: string
  precioEstimado: number | null
  proveedorId: number | null
  proveedorTexto: string | null
  proveedor: { nombre: string; direccion: string | null; telefono: string | null } | null
  proyecto: { nombre: string } | null
}

function fmt(v: number) {
  return `RD$ ${v.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function ImprimirRutaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rutaId = parseInt(id)
  if (isNaN(rutaId)) notFound()

  const ruta = await prisma.rutaCompra.findUnique({
    where: { id: rutaId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: {
          proveedor: { select: { nombre: true, direccion: true, telefono: true } },
          proyecto: { select: { nombre: true } },
        },
      },
    },
  })

  if (!ruta) notFound()

  // Agrupar por suplidor
  const map = new Map<string, { nombre: string; direccion: string | null; telefono: string | null; items: ItemImpr[] }>()
  for (const it of ruta.items as ItemImpr[]) {
    const key = it.proveedorId ? `id:${it.proveedorId}` : it.proveedorTexto ? `t:${it.proveedorTexto}` : 'sin'
    if (!map.has(key)) {
      map.set(key, { nombre: it.proveedor?.nombre || it.proveedorTexto || 'Sin suplidor asignado', direccion: it.proveedor?.direccion || null, telefono: it.proveedor?.telefono || null, items: [] })
    }
    map.get(key)!.items.push(it)
  }
  const paradas = Array.from(map.values())
  const totalEstimado = (ruta.items as ItemImpr[]).reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
  const fecha = new Date(ruta.fecha).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <PrintButton />
        <a href={`/compras/rutas/${ruta.id}`} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm">Volver</a>
      </div>

      <div className="max-w-[800px] mx-auto p-8 print:p-4 print:max-w-none">
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ruta de Compra</h1>
              {ruta.titulo && <p className="text-gray-600 mt-1">{ruta.titulo}</p>}
            </div>
            <div className="text-right text-sm text-gray-600">
              <p className="font-mono font-bold text-gray-900">{ruta.codigo}</p>
              <p>Fecha: {fecha}</p>
              {ruta.comprador && <p>Comprador: {ruta.comprador}</p>}
            </div>
          </div>
        </div>

        {paradas.map((parada, pi) => {
          const sub = parada.items.reduce((s, i) => s + (i.precioEstimado ?? 0), 0)
          return (
            <div key={pi} className="mb-6">
              <div className="border-b border-gray-300 pb-1 mb-2">
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{pi + 1}. {parada.nombre}</h2>
                <p className="text-xs text-gray-500">{[parada.direccion, parada.telefono].filter(Boolean).join(' · ')}</p>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-600">
                    <th className="text-center py-1.5 font-medium w-8">✓</th>
                    <th className="text-left py-1.5 font-medium">Material</th>
                    <th className="text-left py-1.5 font-medium">Proyecto</th>
                    <th className="text-center py-1.5 font-medium">Urg.</th>
                    <th className="text-center py-1.5 font-medium">Cant.</th>
                    <th className="text-right py-1.5 font-medium">Estimado</th>
                    <th className="text-right py-1.5 font-medium w-28">Precio real</th>
                  </tr>
                </thead>
                <tbody>
                  {parada.items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="py-1.5 text-center"><div className="w-4 h-4 border border-gray-400 rounded mx-auto" /></td>
                      <td className="py-1.5 text-gray-800 font-medium">{it.descripcion}</td>
                      <td className="py-1.5 text-gray-500">{it.proyecto?.nombre || '-'}</td>
                      <td className="py-1.5 text-center text-gray-500">{it.urgencia}</td>
                      <td className="py-1.5 text-center text-gray-800">{it.cantidad} {it.unidad}</td>
                      <td className="py-1.5 text-right text-gray-500">{it.precioEstimado != null ? fmt(it.precioEstimado) : '-'}</td>
                      <td className="py-1.5 text-right text-gray-300">_________</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300">
                    <td colSpan={5} className="py-1.5 text-right text-gray-500 text-xs font-medium">Subtotal estimado:</td>
                    <td className="py-1.5 text-right font-bold text-gray-800">{fmt(sub)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}

        <div className="border-t-2 border-gray-800 mt-6 pt-4 flex justify-between items-center">
          <span className="text-sm text-gray-600">{ruta.items.length} materiales · {paradas.length} paradas</span>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase">Total Estimado</p>
            <p className="text-xl font-bold text-gray-900">{fmt(totalEstimado)}</p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8">
          <div><div className="border-b border-gray-400 mb-1 h-8" /><p className="text-xs text-gray-500 text-center">Firma del Comprador</p></div>
          <div><div className="border-b border-gray-400 mb-1 h-8" /><p className="text-xs text-gray-500 text-center">Recibido</p></div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 15mm; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
