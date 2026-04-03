import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { PrintButton } from './PrintButton'

export default async function ListaCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const orden = await prisma.ordenProduccion.findUnique({
    where: { id: parseInt(id) },
    include: {
      proyecto: { select: { nombre: true } },
      materiales: {
        orderBy: { tipo: 'asc' },
      },
      items: {
        select: { nombreModulo: true, cantidad: true, dimensiones: true, tipoModulo: true },
      },
    },
  })

  if (!orden) notFound()

  // Group materials by type
  const tableros = orden.materiales.filter(m => m.tipo === 'tablero')
  const cantos = orden.materiales.filter(m => m.tipo === 'canto')
  const herrajes = orden.materiales.filter(m => m.tipo === 'herraje')
  const otros = orden.materiales.filter(m => !['tablero', 'canto', 'herraje'].includes(m.tipo || ''))

  const totalCost = orden.materiales.reduce((s, m) => s + m.costoTotal, 0)
  const fecha = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-white">
      {/* Print button - hidden on print */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-3">
        <PrintButton />
        <a
          href={`/produccion/${orden.id}`}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
        >
          Volver
        </a>
      </div>

      {/* Print content */}
      <div className="max-w-[800px] mx-auto p-8 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lista de Compra de Materiales</h1>
              <p className="text-gray-600 mt-1">{orden.nombre}</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p className="font-mono font-bold text-gray-900">{orden.codigo}</p>
              <p>Fecha: {fecha}</p>
              {orden.proyecto && <p>Proyecto: {orden.proyecto.nombre}</p>}
              <p>Prioridad: {orden.prioridad}</p>
            </div>
          </div>
        </div>

        {/* Modules summary */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Módulos a Producir</h2>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {orden.items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-400">•</span>
                <span className="text-gray-800">{item.nombreModulo}</span>
                {item.cantidad > 1 && <span className="text-gray-500">×{item.cantidad}</span>}
                {item.dimensiones && <span className="text-gray-400">({item.dimensiones})</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Material tables */}
        {tableros.length > 0 && (
          <MaterialSection title="Tableros" items={tableros} />
        )}
        {cantos.length > 0 && (
          <MaterialSection title="Cantos" items={cantos} />
        )}
        {herrajes.length > 0 && (
          <MaterialSection title="Herrajes" items={herrajes} />
        )}
        {otros.length > 0 && (
          <MaterialSection title="Otros" items={otros} />
        )}

        {/* Total */}
        <div className="border-t-2 border-gray-800 mt-6 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{orden.materiales.length} materiales en total</span>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Total Estimado</p>
              <p className="text-xl font-bold text-gray-900">
                RD${totalCost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Checkboxes for driver */}
        <div className="mt-8 border-t border-gray-300 pt-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Control de Compra</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 rounded" />
              <span className="text-gray-700">Todos los materiales comprados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 rounded" />
              <span className="text-gray-700">Factura/recibo adjunto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 rounded" />
              <span className="text-gray-700">Cantidades verificadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 rounded" />
              <span className="text-gray-700">Materiales entregados en taller</span>
            </div>
          </div>
        </div>

        {/* Signature lines */}
        <div className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p className="text-xs text-gray-500 text-center">Firma del Chofer / Comprador</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 h-8" />
            <p className="text-xs text-gray-500 text-center">Recibido en Taller</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 15mm; size: letter; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

function MaterialSection({
  title,
  items,
}: {
  title: string
  items: { nombre: string; unidad: string; cantidadRequerida: number; costoUnitario: number; costoTotal: number; proveedor: string | null }[]
}) {
  const subtotal = items.reduce((s, m) => s + m.costoTotal, 0)

  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1.5 font-medium text-gray-600 w-8">#</th>
            <th className="text-left py-1.5 font-medium text-gray-600">Material</th>
            <th className="text-left py-1.5 font-medium text-gray-600">Proveedor</th>
            <th className="text-center py-1.5 font-medium text-gray-600">Cantidad</th>
            <th className="text-right py-1.5 font-medium text-gray-600">Precio</th>
            <th className="text-right py-1.5 font-medium text-gray-600">Subtotal</th>
            <th className="text-center py-1.5 font-medium text-gray-600 w-8">✓</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5 text-gray-400">{i + 1}</td>
              <td className="py-1.5 text-gray-800 font-medium">{m.nombre}</td>
              <td className="py-1.5 text-gray-500">{m.proveedor || '-'}</td>
              <td className="py-1.5 text-center text-gray-800">
                {m.cantidadRequerida} {m.unidad}
              </td>
              <td className="py-1.5 text-right text-gray-500">
                RD${m.costoUnitario.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 text-right text-gray-800">
                RD${m.costoTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-1.5 text-center">
                <div className="w-4 h-4 border border-gray-300 rounded mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300">
            <td colSpan={5} className="py-1.5 text-right text-gray-500 text-xs font-medium">Subtotal {title}:</td>
            <td className="py-1.5 text-right font-bold text-gray-800">
              RD${subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
