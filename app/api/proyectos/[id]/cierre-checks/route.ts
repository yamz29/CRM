import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/proyectos/[id]/cierre-checks
 *
 * Calcula el estado de pendientes ANTES de cerrar un proyecto. Devuelve
 * dos arrays: bloqueantes (impiden el cierre) y advertencias (permiten
 * cerrar marcando "entiendo que…").
 *
 * Bloqueantes:
 * - Facturas de ingreso del proyecto con saldo > 0
 * - Facturas de egreso del proyecto con saldo > 0
 * - Adicionales en estado 'propuesto' (sin decidir)
 *
 * Advertencias:
 * - Avance físico < 100%
 * - Actividades de cronograma sin completar (pctAvance < 100)
 * - Items de punchlist abiertos
 * - Margen bruto negativo (gastos > ingresos cobrados)
 * - Gastos sin clasificar a partida
 */
export const GET = withPermiso('proyectos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: {
      id: true, nombre: true, estado: true, avanceFisico: true,
      fechaCierre: true,
    },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Si ya está cerrado, devolvemos eso para que la UI muestre el estado
  if (proyecto.estado === 'Cerrado') {
    return NextResponse.json({
      yaCerrado: true,
      fechaCierre: proyecto.fechaCierre,
      bloqueantes: [],
      advertencias: [],
    })
  }

  // ── Facturas pendientes ──────────────────────────────────────────────
  const facturas = await prisma.factura.findMany({
    where: { proyectoId, estado: { not: 'anulada' } },
    select: { id: true, numero: true, tipo: true, total: true, montoPagado: true, esProforma: true },
  })

  // Para el cierre del proyecto miramos flujo de caja real, no estado fiscal:
  // si una proforma fue pagada, el dinero entró igual. Si tiene saldo, bloquea
  // igual que una factura fiscal. La distinción esProforma solo importa para
  // reportes DGII, no para cerrar el proyecto.
  const facturasIngresoPendientes = facturas.filter(f =>
    f.tipo === 'ingreso' && (f.total - f.montoPagado) > 0.01
  )
  const facturasEgresoPendientes = facturas.filter(f =>
    f.tipo === 'egreso' && (f.total - f.montoPagado) > 0.01
  )

  const saldoIngresoPendiente = facturasIngresoPendientes.reduce(
    (s, f) => s + (f.total - f.montoPagado), 0
  )
  const saldoEgresoPendiente = facturasEgresoPendientes.reduce(
    (s, f) => s + (f.total - f.montoPagado), 0
  )

  // ── Adicionales propuestos ───────────────────────────────────────────
  const adicionalesPropuestos = await prisma.adicionalProyecto.count({
    where: { proyectoId, estado: 'propuesto' },
  })

  // ── Cronograma: actividades sin terminar ─────────────────────────────
  const cronogramas = await prisma.cronograma.findMany({
    where: { proyectoId },
    select: { id: true },
  })
  const cronogramaIds = cronogramas.map(c => c.id)
  let actividadesAbiertas = 0
  if (cronogramaIds.length > 0) {
    actividadesAbiertas = await prisma.actividadCronograma.count({
      where: { cronogramaId: { in: cronogramaIds }, pctAvance: { lt: 100 } },
    })
  }

  // ── Punchlist abiertos ───────────────────────────────────────────────
  const punchlistAbiertos = await prisma.punchItem.count({
    where: { proyectoId, estado: { notIn: ['cerrado', 'rechazado'] } },
  })

  // ── Gastos sin clasificar ────────────────────────────────────────────
  const gastosSinClasificar = await prisma.gastoProyecto.count({
    where: { proyectoId, partidaId: null, estado: { not: 'Anulado' } },
  })

  // ── Margen: ingresos cobrados vs gastos reales ───────────────────────
  // Incluimos proformas: si están pagadas, el dinero entró al proyecto.
  const totalCobrado = facturas
    .filter(f => f.tipo === 'ingreso')
    .reduce((s, f) => s + f.montoPagado, 0)
  const gastosAgg = await prisma.gastoProyecto.aggregate({
    where: { proyectoId, estado: { not: 'Anulado' } },
    _sum: { monto: true },
  })
  const totalGastos = gastosAgg._sum.monto ?? 0
  const margenBruto = totalCobrado - totalGastos

  // ── Construir checks ─────────────────────────────────────────────────
  type Check = { codigo: string; mensaje: string; detalle?: string; cantidad?: number }
  const bloqueantes: Check[] = []
  const advertencias: Check[] = []

  if (facturasIngresoPendientes.length > 0) {
    bloqueantes.push({
      codigo: 'facturas-ingreso-pendientes',
      mensaje: `Hay ${facturasIngresoPendientes.length} factura(s) de ingreso con saldo pendiente`,
      detalle: `Saldo total por cobrar: RD$ ${saldoIngresoPendiente.toFixed(2)}. Cobra o anula antes de cerrar.`,
      cantidad: facturasIngresoPendientes.length,
    })
  }
  if (facturasEgresoPendientes.length > 0) {
    bloqueantes.push({
      codigo: 'facturas-egreso-pendientes',
      mensaje: `Hay ${facturasEgresoPendientes.length} factura(s) de egreso sin pagar`,
      detalle: `Saldo total por pagar: RD$ ${saldoEgresoPendiente.toFixed(2)}. Paga o anula antes de cerrar.`,
      cantidad: facturasEgresoPendientes.length,
    })
  }
  if (adicionalesPropuestos > 0) {
    bloqueantes.push({
      codigo: 'adicionales-propuestos',
      mensaje: `Hay ${adicionalesPropuestos} adicional(es) en estado "propuesto" sin decidir`,
      detalle: `Apruébalos o recházalos antes de cerrar.`,
      cantidad: adicionalesPropuestos,
    })
  }

  if (proyecto.avanceFisico < 100) {
    advertencias.push({
      codigo: 'avance-fisico',
      mensaje: `Avance físico del proyecto está en ${proyecto.avanceFisico}%`,
      detalle: 'Si la obra terminó, marca el avance al 100% antes de cerrar.',
    })
  }
  if (actividadesAbiertas > 0) {
    advertencias.push({
      codigo: 'cronograma-abierto',
      mensaje: `${actividadesAbiertas} actividad(es) del cronograma sin completar`,
      detalle: 'Marca como completadas o quedarán como pendientes en el informe.',
      cantidad: actividadesAbiertas,
    })
  }
  if (punchlistAbiertos > 0) {
    advertencias.push({
      codigo: 'punchlist-abierto',
      mensaje: `${punchlistAbiertos} item(s) del punchlist sin cerrar`,
      detalle: 'Resuélvelos o márcalos como rechazados.',
      cantidad: punchlistAbiertos,
    })
  }
  if (gastosSinClasificar > 0) {
    advertencias.push({
      codigo: 'gastos-sin-clasificar',
      mensaje: `${gastosSinClasificar} gasto(s) sin asignar a partida`,
      detalle: 'Asigna partida para que aparezcan correctamente en el informe.',
      cantidad: gastosSinClasificar,
    })
  }
  if (margenBruto < 0) {
    advertencias.push({
      codigo: 'margen-negativo',
      mensaje: `El margen bruto es negativo: RD$ ${margenBruto.toFixed(2)}`,
      detalle: `Cobrado: RD$ ${totalCobrado.toFixed(2)} · Gastado: RD$ ${totalGastos.toFixed(2)}. El proyecto cierra en pérdida.`,
    })
  }

  return NextResponse.json({
    yaCerrado: false,
    bloqueantes,
    advertencias,
    resumen: {
      totalCobrado,
      totalGastos,
      margenBruto,
      saldoIngresoPendiente,
      saldoEgresoPendiente,
      avanceFisico: proyecto.avanceFisico,
    },
  })
})
