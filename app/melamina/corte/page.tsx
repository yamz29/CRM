import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { notFound } from 'next/navigation'

interface SearchParams { proyecto?: string }

export default async function ListaCorteConsolidadaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { proyecto: proyectoIdStr } = await searchParams
  const proyectoId = proyectoIdStr ? parseInt(proyectoIdStr) : null

  if (!proyectoId || isNaN(proyectoId)) notFound()

  const [proyecto, modulos] = await Promise.all([
    prisma.proyecto.findUnique({ where: { id: proyectoId }, select: { id: true, nombre: true } }),
    prisma.moduloMelaminaV2.findMany({
      where: { proyectoId },
      include: {
        materialTablero: true,
        piezas: { orderBy: { orden: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!proyecto) notFound()

  // Parsear tapacanto JSON de cada pieza
  const modulosConPiezas = modulos.map((m) => ({
    ...m,
    piezas: m.piezas.map((p) => ({
      ...p,
      tapacanto: (() => { try { return JSON.parse(p.tapacanto) as string[] } catch { return [] } })(),
    })),
  }))

  // Totales por tablero
  const totalesPorTablero: Record<string, { nombre: string; precio: number; planchas: number; areaM2: number }> = {}
  for (const m of modulosConPiezas) {
    const tableroNombre = m.materialTablero?.nombre ?? 'Sin tablero'
    const areaPlanchaM2 = m.materialTablero
      ? ((m.materialTablero.anchoMm ?? 2440) * (m.materialTablero.largoMm ?? 1830)) / 1_000_000
      : 4.4652
    const totalAreaM2 = m.piezas.reduce((acc, p) => acc + (p.largo * p.ancho * p.cantidad) / 1_000_000, 0)
    const planchas = totalAreaM2 > 0 ? Math.ceil((totalAreaM2 * 1.15) / areaPlanchaM2) : 0
    if (!totalesPorTablero[tableroNombre]) {
      totalesPorTablero[tableroNombre] = { nombre: tableroNombre, precio: m.materialTablero?.precio ?? 0, planchas: 0, areaM2: 0 }
    }
    totalesPorTablero[tableroNombre].planchas += planchas
    totalesPorTablero[tableroNombre].areaM2 += totalAreaM2
  }

  const totalPiezas = modulosConPiezas.reduce((acc, m) => acc + m.piezas.length, 0)
  const totalAreaM2 = modulosConPiezas.reduce(
    (acc, m) => acc + m.piezas.reduce((a, p) => a + (p.largo * p.ancho * p.cantidad) / 1_000_000, 0),
    0,
  )

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/melamina"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Lista de Corte</h1>
            <p className="text-sm text-slate-500">{proyecto.nombre}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={undefined}>
          <Printer className="w-4 h-4" />
          <span>Imprimir</span>
        </Button>
      </div>

      {/* Print title */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold">Lista de Corte Consolidada — {proyecto.nombre}</h1>
        <p className="text-xs text-gray-500">{modulos.length} módulo(s) · {totalPiezas} piezas · {totalAreaM2.toFixed(3)} m² total</p>
      </div>

      {/* Resumen por tablero */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumen de planchas necesarias (incl. 15% merma)</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Tablero</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Área neta m²</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Planchas</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Costo estimado</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(totalesPorTablero).map((t) => (
              <tr key={t.nombre} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-700">{t.nombre}</td>
                <td className="py-2 text-right text-slate-600 font-mono">{t.areaM2.toFixed(3)}</td>
                <td className="py-2 text-right font-bold text-blue-700">{t.planchas}</td>
                <td className="py-2 text-right text-slate-700 font-mono">{formatCurrency(t.planchas * t.precio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Despiece por módulo */}
      {modulosConPiezas.map((m) => {
        const areaPlanchaM2 = m.materialTablero
          ? ((m.materialTablero.anchoMm ?? 2440) * (m.materialTablero.largoMm ?? 1830)) / 1_000_000
          : 4.4652
        const totalAreaModulo = m.piezas.reduce((acc, p) => acc + (p.largo * p.ancho * p.cantidad) / 1_000_000, 0)
        const planchasModulo = totalAreaModulo > 0 ? Math.ceil((totalAreaModulo * 1.15) / areaPlanchaM2) : 0

        return (
          <div key={m.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Módulo header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {m.codigo && <span className="font-mono text-slate-500 mr-2">{m.codigo}</span>}
                  {m.nombre}
                  {m.cantidad > 1 && <span className="ml-2 text-xs text-slate-500">×{m.cantidad} unid.</span>}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {m.tipoModulo} · {m.ancho}×{m.alto}×{m.profundidad} mm
                  {m.materialTablero && ` · ${m.materialTablero.nombre} (${m.materialTablero.espesorMm ?? 18}mm)`}
                  {' · '}{planchasModulo} plancha{planchasModulo !== 1 ? 's' : ''}
                </p>
              </div>
              <Link href={`/melamina/${m.id}`} className="text-xs text-blue-600 hover:underline print:hidden">
                Ver módulo
              </Link>
            </div>

            {m.piezas.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">Sin piezas registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Etiq.</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Nombre</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Largo mm</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Ancho mm</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Cant.</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Esp. mm</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Tablero</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-semibold">Tapacanto</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-semibold">Área m²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {m.piezas.map((p) => {
                      const area = (p.largo * p.ancho * p.cantidad) / 1_000_000
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-1.5 font-mono text-slate-600">{p.etiqueta}</td>
                          <td className="px-3 py-1.5 text-slate-700">{p.nombre}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{p.largo}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{p.ancho}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-slate-700">{p.cantidad}</td>
                          <td className="px-3 py-1.5 text-right text-slate-600">{p.espesor}</td>
                          <td className="px-3 py-1.5 text-slate-600">{p.material || (m.materialTablero?.nombre ?? '—')}</td>
                          <td className="px-3 py-1.5 text-slate-500">
                            {p.tapacanto.length > 0
                              ? p.tapacanto.map((l: string) => l[0].toUpperCase()).join(' ')
                              : '—'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">{area.toFixed(4)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-slate-600">
                        Subtotal — {m.piezas.length} pieza{m.piezas.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold text-slate-800 font-mono">
                        {totalAreaModulo.toFixed(4)} m²
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {modulos.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          No hay módulos de melamina vinculados a este proyecto.
        </div>
      )}

      {/* Print button fixed */}
      <div className="print:hidden fixed bottom-6 right-6">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-lg hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <Printer className="w-4 h-4" /> Imprimir lista de corte
        </button>
      </div>
    </div>
  )
}
