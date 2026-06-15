import { prisma } from '@/lib/prisma'
import {
  MONEDA_DEFAULT, filtrarGastos, agruparPorDestino, agruparPorMes, agruparPorProyecto,
  calcularKpis, rangoPeriodoAnterior, formatMonto, presetRango,
  type GastoInput,
} from '@/lib/gastos-informe'
import { PrintButton } from './PrintButton'

export default async function ImprimirInformeGastosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const moneda     = sp.moneda || MONEDA_DEFAULT
  const fallback   = presetRango('este-anio')
  const desde      = sp.desde || fallback.desde
  const hasta      = sp.hasta || fallback.hasta
  const destino    = sp.destino || null
  const proyectoId = sp.proyectoId ? Number(sp.proyectoId) : null

  const [gastosRaw, empresa] = await Promise.all([
    prisma.gastoProyecto.findMany({
      include: {
        proyecto: { select: { id: true, nombre: true } },
        partida:  { select: { id: true, descripcion: true, codigo: true } },
      },
      orderBy: [{ fecha: 'desc' }],
    }),
    prisma.empresa.findFirst({ select: { nombre: true } }),
  ])

  const gastos = gastosRaw as unknown as GastoInput[]
  const filtro = { moneda, desde, hasta, destino, proyectoId }
  const filtrados = filtrarGastos(gastos, filtro)
  const prev = rangoPeriodoAnterior(desde, hasta)
  const anteriores = filtrarGastos(gastos, { ...filtro, desde: prev.desde, hasta: prev.hasta })

  const kpis = calcularKpis(filtrados, anteriores)
  const porDestino = agruparPorDestino(filtrados)
  const porMes = agruparPorMes(filtrados)
  const porProyecto = agruparPorProyecto(filtrados)
  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'

  return (
    <div className="max-w-[800px] mx-auto p-8 text-slate-900 bg-white print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <a href="/gastos" className="text-sm text-slate-500 hover:text-slate-800">← Volver a Gastos</a>
        <PrintButton />
      </div>

      <header className="border-b-2 border-slate-800 pb-3 mb-5">
        <h1 className="text-xl font-bold">{nombreEmpresa}</h1>
        <p className="text-lg font-semibold mt-1">Informe de Gastos</p>
        <p className="text-xs text-slate-500 mt-1">
          {desde} a {hasta} · Moneda: {moneda}
          {destino ? ` · Destino: ${destino}` : ''}
        </p>
      </header>

      <section className="grid grid-cols-4 gap-3 mb-6">
        <KpiBox label="Total" valor={formatMonto(kpis.total, moneda)} />
        <KpiBox label="# Gastos" valor={String(kpis.count)} />
        <KpiBox label="Promedio" valor={formatMonto(kpis.promedio, moneda)} />
        <KpiBox label="vs anterior" valor={kpis.deltaPct === null ? '—' : `${kpis.deltaPct >= 0 ? '+' : ''}${(kpis.deltaPct * 100).toFixed(1)}%`} />
      </section>

      <Seccion titulo="Por destino">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
            <th className="py-1">Destino</th><th className="py-1 text-right">Total</th><th className="py-1 text-right">%</th>
          </tr></thead>
          <tbody>
            {porDestino.map(d => (
              <tr key={d.destino} className="border-b border-slate-100">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{formatMonto(d.total, moneda)}</td>
                <td className="py-1 text-right">{(d.pct * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <Seccion titulo="Por mes">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
            <th className="py-1">Mes</th><th className="py-1 text-right">Total</th>
          </tr></thead>
          <tbody>
            {porMes.map(m => (
              <tr key={m.mes} className="border-b border-slate-100">
                <td className="py-1">{m.label}</td>
                <td className="py-1 text-right tabular-nums">{formatMonto(m.total, moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      {porProyecto.length > 0 && (
        <Seccion titulo="Por proyecto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1">Proyecto</th><th className="py-1 text-right"># Gastos</th><th className="py-1 text-right">Total</th>
            </tr></thead>
            <tbody>
              {porProyecto.map(p => (
                <tr key={p.proyectoId ?? 'sin'} className="border-b border-slate-100">
                  <td className="py-1">{p.nombre}</td>
                  <td className="py-1 text-right">{p.count}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(p.total, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {filtrados.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-10">No hay gastos en este periodo.</p>
      )}
    </div>
  )
}

function KpiBox({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5">{valor}</p>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-sm font-bold border-b border-slate-800 pb-1 mb-2">{titulo}</h2>
      {children}
    </section>
  )
}
