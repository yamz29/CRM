import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Users, FolderOpen, PieChart, BarChart3, Award, Lock } from 'lucide-react'

/**
 * /dashboard/ejecutivo — solo Admin.
 *
 * P&L del mes en curso vs mes anterior, top clientes por margen,
 * top proyectos rentables, evolución 6 meses de ingresos/gastos.
 *
 * El dashboard operativo regular vive en / (raíz).
 */
export default async function DashboardEjecutivoPage() {
  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'
  if (!esAdmin) {
    // Si no es admin, redirige al dashboard operativo
    redirect('/')
  }

  // ── Períodos ────────────────────────────────────────────────────────
  const hoy = new Date()
  const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59)
  const inicio6MesesAtras = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)

  // ── Queries paralelas ──────────────────────────────────────────────
  const [
    pagosMesActual,
    pagosMesAnterior,
    gastosMesActualAgg,
    gastosMesAnteriorAgg,
    pagosUltimos6Meses,
    gastosUltimos6Meses,
    proyectosActivos,
    proyectos,
  ] = await Promise.all([
    prisma.pagoFactura.findMany({
      where: {
        fecha: { gte: inicioMesActual },
        factura: { tipo: 'ingreso' },
      },
      select: {
        monto: true, fecha: true,
        factura: { select: { clienteId: true, proyectoId: true, total: true, montoPagado: true, fecha: true } },
      },
    }),
    prisma.pagoFactura.findMany({
      where: {
        fecha: { gte: inicioMesAnterior, lte: finMesAnterior },
        factura: { tipo: 'ingreso' },
      },
      select: { monto: true },
    }),
    prisma.gastoProyecto.aggregate({
      where: { fecha: { gte: inicioMesActual }, estado: { not: 'Anulado' } },
      _sum: { monto: true },
    }),
    prisma.gastoProyecto.aggregate({
      where: {
        fecha: { gte: inicioMesAnterior, lte: finMesAnterior },
        estado: { not: 'Anulado' },
      },
      _sum: { monto: true },
    }),
    // Pagos últimos 6 meses (agrupados por mes en JS para simplicidad)
    prisma.pagoFactura.findMany({
      where: {
        fecha: { gte: inicio6MesesAtras },
        factura: { tipo: 'ingreso' },
      },
      select: { monto: true, fecha: true },
    }),
    prisma.gastoProyecto.findMany({
      where: { fecha: { gte: inicio6MesesAtras }, estado: { not: 'Anulado' } },
      select: { monto: true, fecha: true },
    }),
    prisma.proyecto.count({
      where: { estado: { in: ['Adjudicado', 'En Ejecución'] } },
    }),
    // Proyectos con sus gastos y pagos para calcular margen — incluye todos los no archivados
    prisma.proyecto.findMany({
      where: { archivada: false },
      select: {
        id: true, codigo: true, nombre: true, estado: true,
        cliente: { select: { id: true, nombre: true } },
        gastos: { where: { estado: { not: 'Anulado' } }, select: { monto: true } },
        facturas: {
          where: { tipo: 'ingreso', estado: { not: 'anulada' } },
          select: { montoPagado: true },
        },
      },
    }),
  ])

  // ── Procesar ────────────────────────────────────────────────────────
  const cobradoMesActual = pagosMesActual.reduce((s, p) => s + p.monto, 0)
  const cobradoMesAnterior = pagosMesAnterior.reduce((s, p) => s + p.monto, 0)
  const gastadoMesActual = gastosMesActualAgg._sum.monto ?? 0
  const gastadoMesAnterior = gastosMesAnteriorAgg._sum.monto ?? 0
  const margenMesActual = cobradoMesActual - gastadoMesActual
  const margenMesAnterior = cobradoMesAnterior - gastadoMesAnterior
  const margenPctActual = cobradoMesActual > 0 ? (margenMesActual / cobradoMesActual) * 100 : 0
  const margenPctAnterior = cobradoMesAnterior > 0 ? (margenMesAnterior / cobradoMesAnterior) * 100 : 0

  // Deltas (delta = (actual - anterior) / anterior * 100)
  function delta(actual: number, anterior: number): number | null {
    if (anterior === 0) return actual > 0 ? null : 0  // null = "sin base de comparación"
    return ((actual - anterior) / Math.abs(anterior)) * 100
  }
  const deltaCobrado = delta(cobradoMesActual, cobradoMesAnterior)
  const deltaGastado = delta(gastadoMesActual, gastadoMesAnterior)
  const deltaMargen = delta(margenMesActual, margenMesAnterior)

  // ── Series 6 meses ─────────────────────────────────────────────────
  const meses: { mes: string; ingresos: number; gastos: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0, 23, 59, 59)
    const label = d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    const ingresos = pagosUltimos6Meses
      .filter(p => p.fecha >= d && p.fecha <= finMes)
      .reduce((s, p) => s + p.monto, 0)
    const gastos = gastosUltimos6Meses
      .filter(g => g.fecha >= d && g.fecha <= finMes)
      .reduce((s, g) => s + g.monto, 0)
    meses.push({ mes: label, ingresos, gastos })
  }
  const maxValor = Math.max(1, ...meses.flatMap(m => [m.ingresos, m.gastos]))

  // ── Top clientes / proyectos por margen ────────────────────────────
  type ProyectoCalc = {
    id: number; codigo: string | null; nombre: string; estado: string
    cliente: { id: number; nombre: string } | null
    cobrado: number; gastado: number; margen: number; margenPct: number
  }
  const proyectosCalc: ProyectoCalc[] = proyectos.map(p => {
    const cobrado = p.facturas.reduce((s, f) => s + f.montoPagado, 0)
    const gastado = p.gastos.reduce((s, g) => s + g.monto, 0)
    const margen = cobrado - gastado
    return {
      id: p.id, codigo: p.codigo, nombre: p.nombre, estado: p.estado,
      cliente: p.cliente,
      cobrado, gastado, margen,
      margenPct: cobrado > 0 ? (margen / cobrado) * 100 : 0,
    }
  })

  const topProyectos = [...proyectosCalc]
    .filter(p => p.cobrado > 0)
    .sort((a, b) => b.margen - a.margen)
    .slice(0, 5)

  // Agregar por cliente
  const porCliente = new Map<number, { id: number; nombre: string; cobrado: number; gastado: number; proyectosCount: number }>()
  for (const p of proyectosCalc) {
    if (!p.cliente) continue
    const prev = porCliente.get(p.cliente.id) ?? { id: p.cliente.id, nombre: p.cliente.nombre, cobrado: 0, gastado: 0, proyectosCount: 0 }
    prev.cobrado += p.cobrado
    prev.gastado += p.gastado
    prev.proyectosCount += 1
    porCliente.set(p.cliente.id, prev)
  }
  const topClientes = Array.from(porCliente.values())
    .map(c => ({ ...c, margen: c.cobrado - c.gastado, margenPct: c.cobrado > 0 ? ((c.cobrado - c.gastado) / c.cobrado) * 100 : 0 }))
    .filter(c => c.cobrado > 0)
    .sort((a, b) => b.margen - a.margen)
    .slice(0, 5)

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Dashboard ejecutivo</h1>
            <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Admin
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            P&L del mes, comparativa con mes anterior, top clientes y proyectos por rentabilidad.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver al dashboard operativo
        </Link>
      </div>

      {/* P&L del mes (4 cards grandes) */}
      <div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-500" />
          P&amp;L del mes en curso
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <PLCard
            label="Cobrado"
            valor={cobradoMesActual}
            delta={deltaCobrado}
            tonoPositivo
            comparado={cobradoMesAnterior}
          />
          <PLCard
            label="Gastado"
            valor={gastadoMesActual}
            delta={deltaGastado}
            tonoPositivo={false}
            comparado={gastadoMesAnterior}
          />
          <PLCard
            label="Margen bruto"
            valor={margenMesActual}
            delta={deltaMargen}
            tonoPositivo
            comparado={margenMesAnterior}
            esMargen
          />
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium">Margen %</p>
            <p className={`text-2xl font-black tabular-nums mt-1 ${margenPctActual >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {margenPctActual.toFixed(1)}%
            </p>
            <p className="text-2xs text-muted-foreground mt-1">
              Mes anterior: <span className="tabular-nums">{margenPctAnterior.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      </div>

      {/* Evolución 6 meses */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          Ingresos vs Gastos — últimos 6 meses
        </h2>
        <div className="flex items-end gap-2 h-48">
          {meses.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="w-full flex items-end gap-1 h-40">
                <div
                  className="flex-1 bg-blue-500/80 dark:bg-blue-500/60 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${(m.ingresos / maxValor) * 100}%` }}
                  title={`Ingresos: ${formatCurrency(m.ingresos)}`}
                />
                <div
                  className="flex-1 bg-red-500/80 dark:bg-red-500/60 rounded-t hover:bg-red-600 transition-colors"
                  style={{ height: `${(m.gastos / maxValor) * 100}%` }}
                  title={`Gastos: ${formatCurrency(m.gastos)}`}
                />
              </div>
              <span className="text-2xs text-muted-foreground tabular-nums">{m.mes}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 justify-center">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-500/80" /> Ingresos cobrados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500/80" /> Gastos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top clientes por margen */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            Top clientes (por margen acumulado)
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {topClientes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Aún no hay datos suficientes (clientes con facturas cobradas).
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {topClientes.map((c, i) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                      <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        i === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' :
                        i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i === 0 ? <Award className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.nombre}</p>
                        <p className="text-2xs text-muted-foreground">
                          {c.proyectosCount} proyecto{c.proyectosCount !== 1 ? 's' : ''} · cobrado {formatCurrency(c.cobrado)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${c.margen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(c.margen)}
                        </p>
                        <p className="text-2xs text-muted-foreground tabular-nums">{c.margenPct.toFixed(1)}%</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Top proyectos rentables */}
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-green-500" />
            Top proyectos (por margen)
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {topProyectos.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Aún no hay proyectos con cobros registrados.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {topProyectos.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/proyectos/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                      <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        i === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' :
                        i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i === 0 ? <Award className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.codigo && (
                            <span className="font-mono text-2xs font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                              {p.codigo}
                            </span>
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{p.nombre}</span>
                        </div>
                        <p className="text-2xs text-muted-foreground truncate">
                          {p.cliente?.nombre ?? '—'} · {p.estado}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${p.margen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(p.margen)}
                        </p>
                        <p className="text-2xs text-muted-foreground tabular-nums">{p.margenPct.toFixed(1)}%</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Métricas adicionales */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-orange-500" />
          Resumen del negocio
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Metrica label="Proyectos activos" valor={proyectosActivos} />
          <Metrica
            label="Margen acumulado"
            valor={formatCurrency(proyectosCalc.reduce((s, p) => s + p.margen, 0))}
            color={proyectosCalc.reduce((s, p) => s + p.margen, 0) >= 0 ? 'green' : 'red'}
          />
          <Metrica
            label="Cobrado acumulado"
            valor={formatCurrency(proyectosCalc.reduce((s, p) => s + p.cobrado, 0))}
          />
          <Metrica
            label="Gastado acumulado"
            valor={formatCurrency(proyectosCalc.reduce((s, p) => s + p.gastado, 0))}
          />
        </div>
      </div>
    </div>
  )
}

// ── Helpers de UI ──────────────────────────────────────────────────────

function PLCard({ label, valor, delta, tonoPositivo, comparado, esMargen }: {
  label: string
  valor: number
  delta: number | null
  /** Para "cobrado" y "margen", crecer es bueno (verde). Para "gastado", crecer es malo (rojo). */
  tonoPositivo: boolean
  comparado: number
  esMargen?: boolean
}) {
  const valorColor = esMargen
    ? (valor >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
    : 'text-foreground'

  let deltaColor = 'text-muted-foreground'
  let DeltaIcon = TrendingUp
  if (delta != null) {
    const positivo = tonoPositivo ? delta >= 0 : delta < 0
    deltaColor = positivo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
    DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-1 ${valorColor}`}>
        {formatCurrency(valor)}
      </p>
      <div className="flex items-center gap-2 mt-1">
        {delta != null ? (
          <span className={`text-2xs font-medium flex items-center gap-0.5 ${deltaColor}`}>
            <DeltaIcon className="w-3 h-3" />
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        ) : (
          <span className="text-2xs text-muted-foreground">sin comparación</span>
        )}
        <span className="text-2xs text-muted-foreground">
          mes ant: <span className="tabular-nums">{formatCurrency(comparado)}</span>
        </span>
      </div>
    </div>
  )
}

function Metrica({ label, valor, color }: {
  label: string
  valor: string | number
  color?: 'green' | 'red'
}) {
  const colorClass = color === 'green' ? 'text-green-600 dark:text-green-400'
    : color === 'red' ? 'text-red-600 dark:text-red-400'
    : 'text-foreground'
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${colorClass}`}>{valor}</p>
    </div>
  )
}
