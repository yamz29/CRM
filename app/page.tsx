import { prisma } from '@/lib/prisma'
import { getResumenFinancieroBatch } from '@/lib/resumen-financiero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  AlertTriangle, AlertOctagon, Clock, Receipt, FilePlus, GanttChart,
  Lock, TrendingDown, FolderOpen, ChevronRight, CheckCircle2, Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { TourBanner } from '@/components/onboarding/TourBanner'

const MS_DAY = 86_400_000

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Accion {
  codigo: string
  label: string
  detalle: string
  count: number
  href: string
  Icon: React.ComponentType<{ className?: string }>
  tono: 'rojo' | 'amber' | 'azul' | 'verde'
}

interface ProyectoEnAlerta {
  id: number
  codigo: string | null
  nombre: string
  cliente: string | null
  estado: string
  presupuesto: number
  gastado: number
  variacionPct: number  // (gastado - presupuesto) / presupuesto * 100
  motivo: string
}

interface HitoProximo {
  id: number
  nombre: string
  fechaFin: Date
  diasRestantes: number
  pctAvance: number
  proyectoNombre: string | null
  proyectoId: number | null
  esCritica: boolean
}

interface EtapaCount {
  key: string
  label: string
  count: number
  href: string
  color: string
}

// ── Data ───────────────────────────────────────────────────────────────────

async function getOperacionData() {
  const hoy = new Date()
  const hoyMidnight = new Date(hoy); hoyMidnight.setHours(0, 0, 0, 0)
  const en7Dias = new Date(hoy.getTime() + 7 * MS_DAY)

  const [
    facturasVencidas,
    facturasPorVencer,
    adicionalesPropuestos,
    actividadesAtrasadasAgg,
    proyectosCompletadosNoCerrados,
    proyectos,
    cronogramaActividadesProximas,
    oportunidadesPorEtapa,
    proyectosPorEstadoRaw,
  ] = await Promise.all([
    // Facturas de ingreso vencidas (sin cobrar y fechaVencimiento ya pasó)
    prisma.factura.findMany({
      where: {
        tipo: 'ingreso',
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { lt: hoyMidnight },
      },
      select: { id: true, total: true, montoPagado: true },
    }),
    // Por vencer en próximos 7 días
    prisma.factura.count({
      where: {
        tipo: 'ingreso',
        estado: { in: ['pendiente', 'parcial'] },
        fechaVencimiento: { gte: hoyMidnight, lte: en7Dias },
      },
    }),
    // Adicionales en estado propuesto (sin decidir)
    prisma.adicionalProyecto.count({
      where: { estado: 'propuesto' },
    }),
    // Cronogramas con actividades atrasadas (no completadas con fechaFin < hoy)
    prisma.actividadCronograma.groupBy({
      by: ['cronogramaId'],
      where: {
        pctAvance: { lt: 100 },
        fechaFin: { lt: hoyMidnight },
        cronograma: { proyecto: { estado: { not: 'Cerrado' } } },
      },
      _count: { _all: true },
    }),
    // Proyectos en estado "Completado" o "En Ejecución" con avance 100% (listos para cerrar)
    prisma.proyecto.count({
      where: {
        estado: 'Completado',
        archivada: false,
      },
    }),
    // Proyectos activos para detectar los "en alerta" (sobrecosto)
    prisma.proyecto.findMany({
      where: {
        estado: { in: ['En Ejecución', 'Adjudicado', 'Pausado', 'Completado'] },
        archivada: false,
      },
      select: {
        id: true, codigo: true, nombre: true, estado: true,
        cliente: { select: { nombre: true } },
      },
    }),
    // Próximos hitos: actividades de cronograma que terminan en próximos 7 días
    prisma.actividadCronograma.findMany({
      where: {
        pctAvance: { lt: 100 },
        fechaFin: { gte: hoyMidnight, lte: en7Dias },
        cronograma: { proyecto: { estado: { not: 'Cerrado' } } },
      },
      select: {
        id: true, nombre: true, fechaFin: true, pctAvance: true, esCritica: true,
        cronograma: {
          select: {
            proyecto: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: { fechaFin: 'asc' },
      take: 10,
    }),
    // Oportunidades por etapa
    prisma.oportunidad.groupBy({
      by: ['etapa'],
      where: { etapa: { notIn: ['Ganado', 'Perdido'] } },
      _count: { _all: true },
    }),
    // Proyectos por estado (para mini-kanban)
    prisma.proyecto.groupBy({
      by: ['estado'],
      where: { archivada: false },
      _count: { _all: true },
    }),
  ])

  // ── Procesar facturas vencidas ────────────────────────────────────────
  const saldoVencido = facturasVencidas.reduce(
    (s, f) => s + (f.total - f.montoPagado), 0
  )

  // ── Acciones pendientes ────────────────────────────────────────────────
  const acciones: Accion[] = []
  if (facturasVencidas.length > 0) {
    acciones.push({
      codigo: 'facturas-vencidas',
      label: `${facturasVencidas.length} factura${facturasVencidas.length !== 1 ? 's' : ''} vencida${facturasVencidas.length !== 1 ? 's' : ''} sin cobrar`,
      detalle: `Saldo por cobrar: ${formatCurrency(saldoVencido)}`,
      count: facturasVencidas.length,
      href: '/facturacion?filtroEstado=pendiente',
      Icon: AlertOctagon,
      tono: 'rojo',
    })
  }
  if (facturasPorVencer > 0) {
    acciones.push({
      codigo: 'facturas-por-vencer',
      label: `${facturasPorVencer} factura${facturasPorVencer !== 1 ? 's' : ''} vence${facturasPorVencer !== 1 ? 'n' : ''} en 7 días`,
      detalle: 'Dale seguimiento al cliente antes del vencimiento.',
      count: facturasPorVencer,
      href: '/facturacion',
      Icon: Clock,
      tono: 'amber',
    })
  }
  if (adicionalesPropuestos > 0) {
    acciones.push({
      codigo: 'adicionales-propuestos',
      label: `${adicionalesPropuestos} adicional${adicionalesPropuestos !== 1 ? 'es' : ''} sin decidir`,
      detalle: 'Aprueba o rechaza para que se reflejen en el presupuesto.',
      count: adicionalesPropuestos,
      href: '/proyectos',
      Icon: FilePlus,
      tono: 'amber',
    })
  }
  if (actividadesAtrasadasAgg.length > 0) {
    const totalAct = actividadesAtrasadasAgg.reduce((s, c) => s + c._count._all, 0)
    acciones.push({
      codigo: 'cronogramas-atrasados',
      label: `${totalAct} actividad${totalAct !== 1 ? 'es' : ''} de cronograma atrasada${totalAct !== 1 ? 's' : ''}`,
      detalle: `En ${actividadesAtrasadasAgg.length} cronograma${actividadesAtrasadasAgg.length !== 1 ? 's' : ''} activo${actividadesAtrasadasAgg.length !== 1 ? 's' : ''}.`,
      count: totalAct,
      href: '/cronograma',
      Icon: GanttChart,
      tono: 'amber',
    })
  }
  if (proyectosCompletadosNoCerrados > 0) {
    acciones.push({
      codigo: 'listos-para-cerrar',
      label: `${proyectosCompletadosNoCerrados} proyecto${proyectosCompletadosNoCerrados !== 1 ? 's' : ''} en "Completado"`,
      detalle: 'Obra terminada — listo para cierre formal si todo está cobrado.',
      count: proyectosCompletadosNoCerrados,
      href: '/proyectos/kanban',
      Icon: Lock,
      tono: 'azul',
    })
  }

  // ── Proyectos en alerta (fuente única: lib/resumen-financiero) ─────────
  const resumenes = await getResumenFinancieroBatch(proyectos.map(p => p.id))
  const enAlerta: ProyectoEnAlerta[] = proyectos
    .map(p => {
      const r = resumenes.get(p.id)
      const presupuesto = r?.presupuesto ?? 0
      const gastado = r?.gastado ?? 0
      const variacionPct = presupuesto > 0
        ? ((gastado - presupuesto) / presupuesto) * 100
        : (gastado > 0 ? Infinity : 0)
      const etiquetaFuente = r?.fuente === 'control' ? 'vs control presupuestario' : 'vs estimado inicial'
      const motivo = variacionPct > 100
        ? `Más del doble del presupuesto · ${etiquetaFuente}`
        : variacionPct > 0
          ? `Excede presupuesto en ${variacionPct.toFixed(1)}% · ${etiquetaFuente}`
          : variacionPct > -10
            ? `Quedan menos del 10% (${(-variacionPct).toFixed(1)}%) · ${etiquetaFuente}`
            : ''
      return {
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cliente: p.cliente?.nombre ?? null,
        estado: p.estado,
        presupuesto,
        gastado,
        variacionPct,
        motivo,
      }
    })
    .filter(p => p.motivo !== '')
    .sort((a, b) => b.variacionPct - a.variacionPct)
    .slice(0, 5)

  // ── Próximos hitos ────────────────────────────────────────────────────
  const proximosHitos: HitoProximo[] = cronogramaActividadesProximas.map(a => ({
    id: a.id,
    nombre: a.nombre,
    fechaFin: a.fechaFin,
    diasRestantes: Math.max(0, Math.ceil((a.fechaFin.getTime() - hoy.getTime()) / MS_DAY)),
    pctAvance: a.pctAvance,
    proyectoNombre: a.cronograma?.proyecto?.nombre ?? null,
    proyectoId: a.cronograma?.proyecto?.id ?? null,
    esCritica: a.esCritica,
  }))

  // ── Pipeline visual ──────────────────────────────────────────────────
  const ETAPAS_OP = ['Lead', 'Levantamiento', 'Cotización', 'Negociación']
  const ETAPAS_PROY = ['Prospecto', 'En Cotización', 'Adjudicado', 'En Ejecución', 'Pausado', 'Completado']

  const oportunidades: EtapaCount[] = ETAPAS_OP.map(label => {
    const found = oportunidadesPorEtapa.find(o => o.etapa === label)
    return {
      key: `op-${label}`, label, count: found?._count._all ?? 0,
      href: `/oportunidades?etapa=${encodeURIComponent(label)}`,
      color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    }
  })

  const proyectosPorEstado: EtapaCount[] = ETAPAS_PROY.map(label => {
    const found = proyectosPorEstadoRaw.find(p => p.estado === label)
    return {
      key: `pr-${label}`, label, count: found?._count._all ?? 0,
      href: `/proyectos/kanban`,
      color: label === 'En Ejecución' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200'
        : label === 'Pausado' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200'
        : label === 'Completado' ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200'
        : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200',
    }
  })

  return { acciones, enAlerta, proximosHitos, oportunidades, proyectosPorEstado }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [data, hdrs] = await Promise.all([getOperacionData(), headers()])
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'

  return (
    <div className="space-y-6">
      {/* Banner de onboarding (solo visible primera vez por usuario) */}
      <TourBanner />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lo que necesita tu atención hoy.
          </p>
        </div>
        {esAdmin && (
          <Link
            href="/dashboard/ejecutivo"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            🔒 Vista ejecutiva (admin)
          </Link>
        )}
      </div>

      {/* ── Sección 1: Acciones pendientes ─────────────────────────── */}
      {data.acciones.length === 0 ? (
        <Card>
          <CardContent className="py-8 flex items-center justify-center gap-3 text-muted-foreground">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm">No hay acciones pendientes — todo bajo control.</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Acciones pendientes ({data.acciones.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.acciones.map(a => {
              const Icon = a.Icon
              const tonoClass = {
                rojo: 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30',
                amber: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30',
                azul: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30',
                verde: 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30',
              }[a.tono]
              const iconColor = {
                rojo: 'text-red-600 dark:text-red-400',
                amber: 'text-amber-600 dark:text-amber-400',
                azul: 'text-blue-600 dark:text-blue-400',
                verde: 'text-green-600 dark:text-green-400',
              }[a.tono]
              return (
                <Link
                  key={a.codigo}
                  href={a.href}
                  className={`block border rounded-xl p-4 transition-colors ${tonoClass}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{a.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.detalle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Sección 2: Proyectos en alerta ─────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Proyectos en alerta
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Top con mayor desviación gasto vs presupuesto vigente.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {data.enAlerta.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-60" />
                Ningún proyecto está sobre presupuesto.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.enAlerta.map(p => (
                  <li key={p.id}>
                    <Link
                      href={`/proyectos/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.codigo && (
                            <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                              {p.codigo}
                            </span>
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{p.nombre}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {p.cliente ?? '—'} · {p.motivo}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                          {p.variacionPct > 0 ? '+' : ''}{isFinite(p.variacionPct) ? p.variacionPct.toFixed(0) : '∞'}%
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {formatCurrency(p.gastado)} / {formatCurrency(p.presupuesto)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Sección 3: Próximos hitos (7 días) ──────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-blue-500" />
              Próximos hitos (7 días)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Actividades de cronograma que vencen pronto.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {data.proximosHitos.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Sin actividades programadas en los próximos 7 días.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.proximosHitos.map(h => (
                  <li key={h.id}>
                    <Link
                      href={h.proyectoId ? `/proyectos/${h.proyectoId}?tab=programa` : '/cronograma'}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      {h.esCritica
                        ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        : <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{h.nombre}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {h.proyectoNombre ?? '—'} · {h.pctAvance}% avance
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${
                          h.diasRestantes === 0 ? 'text-red-600 dark:text-red-400'
                          : h.diasRestantes <= 2 ? 'text-amber-600 dark:text-amber-400'
                          : 'text-foreground'
                        }`}>
                          {h.diasRestantes === 0 ? 'Hoy' : `${h.diasRestantes}d`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(h.fechaFin)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Sección 4: Pipeline visual ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline de oportunidades</CardTitle>
            <p className="text-xs text-muted-foreground">Conversiones activas por etapa.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {data.oportunidades.map(e => (
                <Link
                  key={e.key}
                  href={e.href}
                  className={`block border rounded-lg p-2.5 transition-colors hover:opacity-80 ${e.color}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 truncate">
                    {e.label}
                  </p>
                  <p className="text-2xl font-black text-foreground mt-1">{e.count}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proyectos por estado</CardTitle>
            <p className="text-xs text-muted-foreground">Click en el estado para ver el Kanban.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {data.proyectosPorEstado.map(e => (
                <Link
                  key={e.key}
                  href={e.href}
                  className={`block border rounded-lg p-2.5 transition-colors hover:opacity-80 ${e.color}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70 truncate">
                    {e.label}
                  </p>
                  <p className="text-2xl font-black text-foreground mt-1">{e.count}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
