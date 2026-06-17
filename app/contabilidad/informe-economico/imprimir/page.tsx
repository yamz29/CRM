import { prisma } from '@/lib/prisma'
import { MONEDA_DEFAULT, presetRango, formatMonto } from '@/lib/gastos-informe'
import { cargarInforme } from '@/lib/informe-economico-data'
import { PrintButton } from './PrintButton'

function pct(n: number | null): string {
  return n === null ? '—' : `${(n * 100).toFixed(1)}%`
}

export default async function ImprimirInformeEconomicoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const fallback = presetRango('este-mes')
  const desde = sp.desde || fallback.desde
  const hasta = sp.hasta || fallback.hasta

  const [{ data }, empresa] = await Promise.all([
    cargarInforme(desde, hasta),
    prisma.empresa.findFirst({ select: { nombre: true } }),
  ])
  const { kpis, porRenglon, porProyecto, porMes } = data
  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'
  const resultadoColor = kpis.resultado >= 0 ? 'text-green-700' : 'text-red-700'

  return (
    <div className="max-w-[800px] mx-auto p-8 text-slate-900 bg-white print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <a href="/contabilidad" className="text-sm text-slate-500 hover:text-slate-800">← Volver a Contabilidad</a>
        <PrintButton />
      </div>

      <header className="border-b-2 border-slate-800 pb-3 mb-5">
        <h1 className="text-xl font-bold">{nombreEmpresa}</h1>
        <p className="text-lg font-semibold mt-1">Informe Económico — Resultado</p>
        <p className="text-xs text-slate-500 mt-1">
          {desde} a {hasta} · Base caja · Moneda: {MONEDA_DEFAULT}
        </p>
      </header>

      {data.otrasMonedas.count > 0 && (
        <p className="text-xs text-amber-700 border border-amber-300 bg-amber-50 rounded px-3 py-2 mb-4">
          Hay {data.otrasMonedas.count} gasto(s) en otra moneda no incluidos en este informe.
        </p>
      )}

      <section className="grid grid-cols-4 gap-3 mb-6">
        <KpiBox label="Ingresos" valor={formatMonto(kpis.ingresos, MONEDA_DEFAULT)} />
        <KpiBox label="Gastos" valor={formatMonto(kpis.gastos, MONEDA_DEFAULT)} />
        <KpiBox label="Resultado" valor={formatMonto(kpis.resultado, MONEDA_DEFAULT)} valorClass={resultadoColor} />
        <KpiBox label="Margen" valor={pct(kpis.margen)} />
      </section>

      {porRenglon.length > 0 && (
        <Seccion titulo="Gasto por renglón">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1">Renglón</th><th className="py-1 text-right">Total</th><th className="py-1 text-right">%</th>
            </tr></thead>
            <tbody>
              {porRenglon.map(r => (
                <tr key={r.destino} className="border-b border-slate-100">
                  <td className="py-1">{r.label}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(r.total, MONEDA_DEFAULT)}</td>
                  <td className="py-1 text-right">{(r.pct * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {porProyecto.length > 0 && (
        <Seccion titulo="Rentabilidad por proyecto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1">Proyecto</th>
              <th className="py-1 text-right">Ingresos</th>
              <th className="py-1 text-right">Gastos</th>
              <th className="py-1 text-right">Resultado</th>
              <th className="py-1 text-right">Margen</th>
            </tr></thead>
            <tbody>
              {porProyecto.map(p => (
                <tr key={p.proyectoId ?? 'sin'} className="border-b border-slate-100">
                  <td className="py-1">{p.nombre}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(p.ingresos, MONEDA_DEFAULT)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(p.gastos, MONEDA_DEFAULT)}</td>
                  <td className={`py-1 text-right tabular-nums font-semibold ${p.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMonto(p.resultado, MONEDA_DEFAULT)}
                  </td>
                  <td className="py-1 text-right">{pct(p.margen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {porMes.length > 0 && (
        <Seccion titulo="Evolución mensual">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1">Mes</th>
              <th className="py-1 text-right">Ingresos</th>
              <th className="py-1 text-right">Gastos</th>
              <th className="py-1 text-right">Resultado</th>
            </tr></thead>
            <tbody>
              {porMes.map(m => (
                <tr key={m.mes} className="border-b border-slate-100">
                  <td className="py-1">{m.label}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(m.ingresos, MONEDA_DEFAULT)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(m.gastos, MONEDA_DEFAULT)}</td>
                  <td className={`py-1 text-right tabular-nums ${m.resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMonto(m.resultado, MONEDA_DEFAULT)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {kpis.ingresos === 0 && kpis.gastos === 0 && (
        <p className="text-center text-slate-400 text-sm py-10">No hay ingresos ni gastos en este período.</p>
      )}
    </div>
  )
}

function KpiBox({ label, valor, valorClass = '' }: { label: string; valor: string; valorClass?: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className={`text-sm font-bold tabular-nums mt-0.5 ${valorClass}`}>{valor}</p>
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
