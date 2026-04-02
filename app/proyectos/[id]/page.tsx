import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoProyectoBadge, EstadoPresupuestoBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { GastosTab } from '@/components/gastos/GastosTab'
import { ControlPresupuestarioTab } from '@/components/proyectos/ControlPresupuestarioTab'
import { BitacoraTimeline } from '@/components/proyectos/BitacoraTimeline'
import {
  ArrowLeft, Pencil, MapPin, Calendar, User, DollarSign,
  FileText, Plus, Tag, TrendingDown as TrendingDownIcon,
  TrendingUp, AlertTriangle, Receipt, BarChart2, Percent, ClipboardList, BookOpen,
} from 'lucide-react'

async function getProyecto(id: number) {
  return prisma.proyecto.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true } },
      presupuestos: { orderBy: { createdAt: 'desc' } },
      _count: { select: { partidas: true, capitulos: true } },
    },
  })
}

async function getGastosResumen(proyectoId: number) {
  const [agg, cantidad, horas] = await Promise.all([
    prisma.gastoProyecto.aggregate({
      where: { proyectoId, estado: { not: 'Anulado' } },
      _sum: { monto: true },
    }),
    prisma.gastoProyecto.count({
      where: { proyectoId, estado: { not: 'Anulado' } },
    }),
    prisma.registroHoras.findMany({
      where: { proyectoId },
      include: { usuario: { select: { costoHora: true } } },
    }),
  ])

  const costoHoras = horas.reduce((acc, r) => {
    const tarifa = r.usuario?.costoHora ?? 0
    return acc + r.horas * tarifa
  }, 0)
  const totalHoras = horas.reduce((acc, r) => acc + r.horas, 0)

  return {
    total: agg._sum.monto ?? 0,
    cantidad,
    costoHoras,
    totalHoras,
  }
}

export default async function ProyectoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const [{ id: idStr }, sp] = await Promise.all([params, searchParams])
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [proyecto, gastosResumen] = await Promise.all([
    getProyecto(id),
    getGastosResumen(id),
  ])
  if (!proyecto) notFound()

  const tab = sp.tab ?? 'resumen'
  const { total: totalGastado, cantidad: cantidadGastos, costoHoras, totalHoras } = gastosResumen
  const costoTotal = totalGastado + costoHoras
  const balance = proyecto.presupuestoEstimado != null ? proyecto.presupuestoEstimado - costoTotal : null
  const pctGastado = proyecto.presupuestoEstimado ? Math.min((costoTotal / proyecto.presupuestoEstimado) * 100, 100) : null

  // Rentabilidad Real
  const presupuestoAprobado = proyecto.presupuestos.find(p => p.estado === 'Aprobado')
  const ingresos = presupuestoAprobado?.total ?? proyecto.presupuestoEstimado ?? null
  const costos = costoTotal
  const utilidad = ingresos != null ? ingresos - costos : null
  const margen = ingresos != null && ingresos > 0 ? (utilidad! / ingresos) * 100 : null

  // Indicadores de ejecución
  const avanceFisico: number = (proyecto as any).avanceFisico ?? 0
  const presupuestoBase = presupuestoAprobado?.total ?? proyecto.presupuestoEstimado ?? null
  const pctEjecucionFin = presupuestoBase && presupuestoBase > 0
    ? Math.min((costoTotal / presupuestoBase) * 100, 999)
    : null
  // Forecast to Completion: si llevamos X% físico con Y costo, el total proyectado = Y / (X/100)
  const forecastTotal = avanceFisico > 0 && costoTotal > 0
    ? costoTotal / (avanceFisico / 100)
    : null
  const varianzaForecast = presupuestoBase != null && forecastTotal != null
    ? presupuestoBase - forecastTotal
    : null
  // Eficiencia: avance físico vs ejecución financiera
  const eficiencia = avanceFisico > 0 && pctEjecucionFin != null
    ? avanceFisico - pctEjecucionFin  // positivo = bajo presupuesto, negativo = sobreejecutando
    : null

  const tabs = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'presupuestos', label: `Presupuestos (${proyecto.presupuestos.length})` },
    { key: 'gastos', label: `Gastos (${cantidadGastos})`, icon: TrendingDownIcon },
    { key: 'control', label: 'Control presupuestario', icon: BarChart2 },
    { key: 'bitacora', label: 'Bitácora', icon: BookOpen },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/proyectos"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{proyecto.nombre}</h1>
              <EstadoProyectoBadge estado={proyecto.estado} />
            </div>
            <div className="flex items-center gap-4 mt-1">
              <Link href={`/clientes/${proyecto.cliente.id}`}
                className="text-slate-500 text-sm hover:text-blue-600 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {proyecto.cliente.nombre}
              </Link>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 text-sm flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                {proyecto.tipoProyecto}
              </span>
            </div>
          </div>
        </div>
        <Link href={`/proyectos/${proyecto.id}/editar`}>
          <Button variant="secondary">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        </Link>
      </div>

      {/* ── Tab bar ── */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {tabs.map(t => {
            const active = tab === t.key
            return (
              <Link key={t.key} href={`/proyectos/${proyecto.id}?tab=${t.key}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}>
                {t.icon && <t.icon className="w-3.5 h-3.5" />}
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Tab content ── */}

      {/* RESUMEN */}
      {tab === 'resumen' && (
        <div className="space-y-6">

        {/* ── Alerta presupuesto ── */}
        {pctGastado != null && pctGastado >= 90 && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            pctGastado >= 100
              ? 'bg-red-50 border-red-200 dark:bg-red-900/15 dark:border-red-800'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-900/15 dark:border-amber-800'
          }`}>
            <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${pctGastado >= 100 ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`text-sm font-semibold ${pctGastado >= 100 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {pctGastado >= 100
                  ? `Presupuesto superado — ${formatCurrency(Math.abs(balance!))} por encima del límite`
                  : `Advertencia — ${pctGastado.toFixed(0)}% del presupuesto ejecutado`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pctGastado >= 100
                  ? 'Los gastos registrados superan el presupuesto estimado del proyecto.'
                  : `Quedan ${formatCurrency(balance!)} disponibles. Revisa los gastos antes de continuar.`}
              </p>
            </div>
          </div>
        )}

        {/* ── Banner: poblar control presupuestario ── */}
        {presupuestoAprobado && proyecto._count.capitulos === 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-blue-50 border-blue-200 dark:bg-blue-900/15 dark:border-blue-800">
            <ClipboardList className="w-5 h-5 mt-0.5 shrink-0 text-blue-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                Presupuesto aprobado — sin control presupuestario iniciado
              </p>
              <p className="text-xs text-blue-600/80 mt-0.5">
                El presupuesto {presupuestoAprobado.numero} está aprobado. Puedes poblar el control para comparar gastos contra partidas.
              </p>
            </div>
            <Link href={`/proyectos/${proyecto.id}?tab=control`}>
              <Button size="sm" className="shrink-0 text-xs">
                Ir a Control →
              </Button>
            </Link>
          </div>
        )}

        {/* ── Panel de ejecución ── */}
        {(avanceFisico > 0 || pctEjecucionFin != null) && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-slate-400" />
                Indicadores de ejecución
              </h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">

              {/* Avance físico */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Avance físico</p>
                <p className={`text-2xl font-black tabular-nums ${
                  avanceFisico === 100 ? 'text-green-700' : avanceFisico >= 50 ? 'text-blue-700' : 'text-amber-600'
                }`}>{avanceFisico}%</p>
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${avanceFisico}%`,
                    backgroundColor: avanceFisico === 100 ? '#22c55e' : avanceFisico >= 50 ? '#3b82f6' : '#f59e0b',
                  }} />
                </div>
                <p className="text-xs text-slate-400 mt-1">% obra completada</p>
              </div>

              {/* Ejecución financiera */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Ejecución financiera</p>
                {pctEjecucionFin != null ? (
                  <>
                    <p className={`text-2xl font-black tabular-nums ${
                      pctEjecucionFin >= 100 ? 'text-red-600' : pctEjecucionFin >= 80 ? 'text-amber-600' : 'text-slate-800'
                    }`}>{pctEjecucionFin.toFixed(0)}%</p>
                    <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(pctEjecucionFin, 100)}%`,
                        backgroundColor: pctEjecucionFin >= 100 ? '#ef4444' : pctEjecucionFin >= 80 ? '#f59e0b' : '#3b82f6',
                      }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">% presupuesto gastado</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">Sin presupuesto base</p>
                )}
              </div>

              {/* Forecast to Completion */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Forecast de costo</p>
                {forecastTotal != null ? (
                  <>
                    <p className={`text-2xl font-black ${
                      presupuestoBase && forecastTotal > presupuestoBase ? 'text-red-600' : 'text-slate-800'
                    }`}>{formatCurrency(forecastTotal)}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Proyección al 100% físico
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    {avanceFisico === 0 ? 'Requiere avance físico > 0' : 'Sin gastos registrados'}
                  </p>
                )}
              </div>

              {/* Eficiencia / Varianza */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {varianzaForecast != null ? 'Varianza forecast' : 'Eficiencia'}
                </p>
                {varianzaForecast != null ? (
                  <>
                    <p className={`text-2xl font-black ${varianzaForecast >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {varianzaForecast < 0 ? '−' : '+'}{formatCurrency(Math.abs(varianzaForecast))}
                    </p>
                    <p className={`text-xs mt-1 font-medium ${varianzaForecast >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {varianzaForecast >= 0 ? 'Bajo presupuesto' : 'Sobre presupuesto'}
                    </p>
                  </>
                ) : eficiencia != null ? (
                  <>
                    <p className={`text-2xl font-black ${eficiencia >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {eficiencia >= 0 ? '+' : ''}{eficiencia.toFixed(0)} pts
                    </p>
                    <p className={`text-xs mt-1 font-medium ${eficiencia >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {eficiencia >= 0 ? 'Físico adelanta al gasto' : 'Gasto adelanta al físico'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">—</p>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── Tarjeta financiera ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-400" />
              Resumen financiero
            </h3>
            <Link
              href={`/proyectos/${proyecto.id}?tab=gastos`}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todos los gastos →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-slate-100">
            {/* Presupuesto estimado */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Presupuestado</span>
              </div>
              {proyecto.presupuestoEstimado != null ? (
                <p className="text-lg font-black text-slate-800">{formatCurrency(proyecto.presupuestoEstimado)}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No definido</p>
              )}
            </div>

            {/* Gastos directos */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDownIcon className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gastos directos</span>
              </div>
              <p className="text-lg font-black text-slate-800">{formatCurrency(totalGastado)}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {cantidadGastos} {cantidadGastos === 1 ? 'registro' : 'registros'}
              </p>
            </div>

            {/* Mano de obra interna */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">M.O. Interna</span>
              </div>
              {costoHoras > 0 ? (
                <>
                  <p className="text-lg font-black text-slate-800">{formatCurrency(costoHoras)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{totalHoras.toFixed(1)} h registradas</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-black text-slate-400">{formatCurrency(0)}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{totalHoras.toFixed(1)} h · sin tarifa</p>
                </>
              )}
            </div>

            {/* Diferencia / balance */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                {balance == null
                  ? <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                  : balance >= 0
                    ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {balance == null ? 'Diferencia' : balance >= 0 ? 'Disponible' : 'Sobregirado'}
                </span>
              </div>
              {balance != null ? (
                <>
                  <p className={`text-lg font-black ${balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {balance < 0 && '−'}{formatCurrency(Math.abs(balance))}
                  </p>
                  {pctGastado != null && (
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pctGastado >= 100 ? 'bg-red-500' : pctGastado >= 80 ? 'bg-amber-400' : 'bg-green-500'}`}
                          style={{ width: `${pctGastado}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{pctGastado.toFixed(0)}% ejecutado</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">Sin presupuesto base</p>
              )}
            </div>

            {/* Total costos */}
            <div className="px-5 py-4 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1">
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Costo total</span>
              </div>
              <p className="text-lg font-black text-slate-800">{formatCurrency(costoTotal)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Gastos + M.O.</p>
              <Link href={`/proyectos/${proyecto.id}?tab=gastos`}>
                <Button size="sm" variant="secondary" className="mt-2 w-full text-xs">
                  <TrendingDownIcon className="w-3 h-3" /> Ver gastos
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Rentabilidad Real ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Percent className="w-4 h-4 text-slate-400" />
              Rentabilidad real
              {presupuestoAprobado && (
                <span className="text-xs font-normal text-slate-400 ml-1">
                  · basada en presupuesto aprobado {presupuestoAprobado.numero}
                </span>
              )}
            </h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
            {/* Ingresos */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingresos</span>
              </div>
              {ingresos != null ? (
                <p className="text-lg font-black text-blue-700">{formatCurrency(ingresos)}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">Sin presupuesto aprobado</p>
              )}
            </div>

            {/* Costos */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDownIcon className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Costos reales</span>
              </div>
              <p className="text-lg font-black text-red-700">{formatCurrency(costos)}</p>
            </div>

            {/* Utilidad */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilidad</span>
              </div>
              {utilidad != null ? (
                <p className={`text-lg font-black ${utilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {utilidad < 0 && '−'}{formatCurrency(Math.abs(utilidad))}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">—</p>
              )}
            </div>

            {/* Margen % */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Margen</span>
              </div>
              {margen != null ? (
                <>
                  <p className={`text-lg font-black ${margen >= 15 ? 'text-green-700' : margen >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {margen.toFixed(1)}%
                  </p>
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${margen >= 15 ? 'bg-green-500' : margen >= 0 ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.max(margen, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">—</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader><CardTitle>Detalles del Proyecto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {proyecto.ubicacion && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Ubicación</p>
                      <p className="text-sm font-medium text-slate-700">{proyecto.ubicacion}</p>
                    </div>
                  </div>
                )}
                {proyecto.fechaInicio && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Fecha de inicio</p>
                      <p className="text-sm font-medium text-slate-700">{formatDate(proyecto.fechaInicio)}</p>
                    </div>
                  </div>
                )}
                {proyecto.fechaEstimada && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Término estimado</p>
                      <p className="text-sm font-medium text-slate-700">{formatDate(proyecto.fechaEstimada)}</p>
                    </div>
                  </div>
                )}
                {proyecto.responsable && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Responsable</p>
                      <p className="text-sm font-medium text-slate-700">{proyecto.responsable}</p>
                    </div>
                  </div>
                )}
                {proyecto.presupuestoEstimado && (
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Presupuesto estimado</p>
                      <p className="text-sm font-bold text-slate-700">{formatCurrency(proyecto.presupuestoEstimado)}</p>
                    </div>
                  </div>
                )}
                {(proyecto as any).avanceFisico > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-4 h-4 mt-0.5 flex-shrink-0 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">Avance físico</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(proyecto as any).avanceFisico}%`,
                              backgroundColor: (proyecto as any).avanceFisico === 100 ? '#22c55e' : (proyecto as any).avanceFisico >= 50 ? '#3b82f6' : '#f59e0b',
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700 tabular-nums">{(proyecto as any).avanceFisico}%</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Creado el</p>
                  <p className="text-sm text-slate-600 mt-0.5">{formatDate(proyecto.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            {proyecto.descripcion && (
              <Card>
                <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed">{proyecto.descripcion}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Presupuestos preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Presupuestos ({proyecto.presupuestos.length})
                  </CardTitle>
                  <Link href={`/presupuestos/nuevo?proyectoId=${proyecto.id}&clienteId=${proyecto.clienteId}`}>
                    <Button size="sm" variant="secondary">
                      <Plus className="w-3.5 h-3.5" /> Nuevo
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {proyecto.presupuestos.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <FileText className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-slate-500 text-sm">Sin presupuestos para este proyecto</p>
                    <Link href={`/presupuestos/nuevo?proyectoId=${proyecto.id}&clienteId=${proyecto.clienteId}`} className="mt-3">
                      <Button size="sm"><Plus className="w-3.5 h-3.5" /> Crear presupuesto</Button>
                    </Link>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Número</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Total</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Ver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {proyecto.presupuestos.slice(0, 5).map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <Link href={`/presupuestos/${p.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">{p.numero}</Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(p.createdAt)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-800">{formatCurrency(p.total)}</td>
                          <td className="px-4 py-3"><EstadoPresupuestoBadge estado={p.estado} /></td>
                          <td className="px-4 py-3">
                            <Link href={`/presupuestos/${p.id}`}><Button variant="ghost" size="sm">Ver</Button></Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      )}

      {/* PRESUPUESTOS */}
      {tab === 'presupuestos' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Presupuestos del Proyecto
              </CardTitle>
              <Link href={`/presupuestos/nuevo?proyectoId=${proyecto.id}&clienteId=${proyecto.clienteId}`}>
                <Button size="sm">
                  <Plus className="w-3.5 h-3.5" /> Nuevo presupuesto
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {proyecto.presupuestos.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <FileText className="w-12 h-12 text-slate-200 mb-3" />
                <p className="text-slate-500 text-sm">Sin presupuestos para este proyecto</p>
                <Link href={`/presupuestos/nuevo?proyectoId=${proyecto.id}&clienteId=${proyecto.clienteId}`} className="mt-3">
                  <Button size="sm"><Plus className="w-3.5 h-3.5" /> Crear presupuesto</Button>
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Número</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proyecto.presupuestos.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/presupuestos/${p.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">{p.numero}</Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">{formatCurrency(p.total)}</td>
                      <td className="px-4 py-3"><EstadoPresupuestoBadge estado={p.estado} /></td>
                      <td className="px-4 py-3 flex gap-2">
                        <Link href={`/presupuestos/${p.id}`}><Button variant="ghost" size="sm">Ver</Button></Link>
                        <Link href={`/presupuestos/${p.id}/imprimir`}><Button variant="ghost" size="sm">Imprimir</Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* GASTOS */}
      {tab === 'gastos' && (
        <GastosTab
          proyectoId={proyecto.id}
          presupuestoEstimado={proyecto.presupuestoEstimado}
        />
      )}

      {/* CONTROL PRESUPUESTARIO */}
      {tab === 'control' && (
        <ControlPresupuestarioTab
          proyectoId={proyecto.id}
          presupuestoBaseId={proyecto.presupuestoBaseId ?? null}
        />
      )}

      {/* BITÁCORA */}
      {tab === 'bitacora' && (
        <BitacoraTimeline
          proyectoId={proyecto.id}
          avanceFisicoActual={avanceFisico}
        />
      )}
    </div>
  )
}
