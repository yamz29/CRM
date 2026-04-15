import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

/**
 * Transacción unificada: fusiona Factura + GastoProyecto en un solo registro.
 *
 * Reglas de deduplicación:
 *   - Factura con GastoProyecto vinculado (via facturaId) → 1 registro combinado
 *   - Factura sin gasto → 1 registro (solo contable)
 *   - Gasto sin factura → 1 registro (solo proyecto)
 *
 * Evita doble conteo en los totales.
 */

export interface TransaccionUnificada {
  id: string                    // "fac-123" o "gas-456"
  tipo: 'ingreso' | 'egreso'
  fuente: 'factura' | 'gasto' | 'ambos'
  facturaId: number | null
  gastoId: number | null
  fecha: string
  numero: string | null         // número de factura o referencia
  ncf: string | null
  descripcion: string
  proveedor: string | null
  cliente: { id: number; nombre: string } | null
  proyecto: { id: number; nombre: string } | null
  partidaId: number | null
  destinoTipo: string
  monto: number
  montoPagado: number           // de la factura si existe
  estadoPago: string            // 'pendiente'|'parcial'|'pagada'|'anulada'|'n/a'
  metodoPago: string | null
  archivoUrl: string | null
  driveUrl: string | null
  observaciones: string | null
}

export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const sp = request.nextUrl.searchParams
  const tipo = sp.get('tipo')           // ingreso | egreso
  const estado = sp.get('estado')       // pendiente | parcial | pagada | anulada
  const fuente = sp.get('fuente')       // factura | gasto | ambos
  const q = sp.get('q')
  const desde = sp.get('desde')
  const hasta = sp.get('hasta')
  const proyectoId = sp.get('proyectoId')

  // Rango de fechas
  const fechaFilter: { gte?: Date; lte?: Date } = {}
  if (desde) fechaFilter.gte = new Date(desde)
  if (hasta) fechaFilter.lte = new Date(hasta + 'T23:59:59')
  const hasFecha = fechaFilter.gte || fechaFilter.lte

  // ── 1. Traer facturas
  const facturaWhere: Record<string, unknown> = {}
  if (tipo) facturaWhere.tipo = tipo
  if (estado) facturaWhere.estado = estado
  if (proyectoId) facturaWhere.proyectoId = parseInt(proyectoId)
  if (hasFecha) facturaWhere.fecha = fechaFilter
  if (q) {
    facturaWhere.OR = [
      { numero: { contains: q } },
      { ncf: { contains: q } },
      { proveedor: { contains: q } },
      { descripcion: { contains: q } },
      { cliente: { nombre: { contains: q } } },
    ]
  }

  const facturas = await prisma.factura.findMany({
    where: facturaWhere,
    include: {
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
      gasto: { select: { id: true, partidaId: true, metodoPago: true, cuentaOrigen: true } },
    },
    orderBy: { fecha: 'desc' },
  })

  // ── 2. Traer gastos (solo los que NO tienen factura vinculada, para evitar duplicados)
  const gastoWhere: Record<string, unknown> = { facturaId: null }
  if (proyectoId) gastoWhere.proyectoId = parseInt(proyectoId)
  if (hasFecha) gastoWhere.fecha = fechaFilter
  // Los gastos siempre son egreso-like, así que si filtran por 'ingreso' no se incluyen
  if (tipo === 'ingreso') {
    // Sin resultados de gastos
    gastoWhere.id = -1
  }
  if (q) {
    gastoWhere.OR = [
      { referencia: { contains: q } },
      { descripcion: { contains: q } },
      { suplidor: { contains: q } },
    ]
  }

  const gastos = await prisma.gastoProyecto.findMany({
    where: gastoWhere,
    include: {
      proyecto: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  })

  // ── 3. Combinar en lista unificada
  const transacciones: TransaccionUnificada[] = []

  for (const f of facturas) {
    transacciones.push({
      id: `fac-${f.id}`,
      tipo: f.tipo as 'ingreso' | 'egreso',
      fuente: f.gasto ? 'ambos' : 'factura',
      facturaId: f.id,
      gastoId: f.gasto?.id ?? null,
      fecha: f.fecha.toISOString(),
      numero: f.numero,
      ncf: f.ncf,
      descripcion: f.descripcion ?? `Factura ${f.numero}`,
      proveedor: f.proveedor,
      cliente: f.cliente,
      proyecto: f.proyecto,
      partidaId: f.gasto?.partidaId ?? null,
      destinoTipo: f.destinoTipo,
      monto: f.total,
      montoPagado: f.montoPagado,
      estadoPago: f.estado,
      metodoPago: f.gasto?.metodoPago ?? null,
      archivoUrl: f.archivoUrl,
      driveUrl: f.driveUrl,
      observaciones: f.observaciones,
    })
  }

  for (const g of gastos) {
    if (fuente === 'factura') continue  // solo facturas
    transacciones.push({
      id: `gas-${g.id}`,
      tipo: 'egreso',
      fuente: 'gasto',
      facturaId: null,
      gastoId: g.id,
      fecha: g.fecha.toISOString(),
      numero: g.referencia,
      ncf: null,
      descripcion: g.descripcion,
      proveedor: g.suplidor,
      cliente: null,
      proyecto: g.proyecto,
      partidaId: g.partidaId,
      destinoTipo: g.destinoTipo,
      monto: g.monto,
      montoPagado: g.monto, // gastos se consideran pagados
      estadoPago: 'n/a',
      metodoPago: g.metodoPago,
      archivoUrl: g.archivoUrl,
      driveUrl: null,
      observaciones: g.observaciones,
    })
  }

  if (fuente === 'gasto') {
    // Solo gastos sin factura
    const onlyGastos = transacciones.filter(t => t.fuente === 'gasto')
    transacciones.length = 0
    transacciones.push(...onlyGastos)
  } else if (fuente === 'factura') {
    const onlyFacturas = transacciones.filter(t => t.fuente === 'factura' || t.fuente === 'ambos')
    transacciones.length = 0
    transacciones.push(...onlyFacturas)
  }

  // Ordenar por fecha desc
  transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  // ── 4. Totales deduplicados
  const resumen = {
    totalIngresos: 0,
    totalEgresos: 0,
    totalPagado: 0,
    porCobrar: 0,  // facturas ingreso pendientes
    porPagar: 0,   // facturas egreso pendientes
    cantidad: transacciones.length,
  }

  for (const t of transacciones) {
    if (t.estadoPago === 'anulada') continue
    if (t.tipo === 'ingreso') {
      resumen.totalIngresos += t.monto
      resumen.totalPagado += t.montoPagado
      if (t.estadoPago === 'pendiente' || t.estadoPago === 'parcial') {
        resumen.porCobrar += t.monto - t.montoPagado
      }
    } else {
      resumen.totalEgresos += t.monto
      if (t.estadoPago === 'pendiente' || t.estadoPago === 'parcial') {
        resumen.porPagar += t.monto - t.montoPagado
      }
    }
  }

  return NextResponse.json({ transacciones, resumen })
}

/**
 * POST unificado: crea una transacción decidiendo qué registros generar.
 *
 * Body:
 *   {
 *     tipo: 'ingreso' | 'egreso',
 *     fecha: ISO,
 *     descripcion: string,
 *     monto: number,
 *     // Campos de factura (opcionales)
 *     numero?: string, ncf?: string, fechaVencimiento?: string,
 *     proveedor?: string, proveedorId?: number, rncProveedor?: string,
 *     clienteId?: number,
 *     subtotal?: number, impuesto?: number,
 *     // Campos de proyecto (opcionales)
 *     proyectoId?: number, partidaId?: number, destinoTipo?: string,
 *     metodoPago?: string, cuentaOrigen?: string,
 *     // Flags
 *     crearFactura?: boolean (default: true si hay numero o ncf)
 *     crearGasto?: boolean (default: true si hay proyectoId)
 *   }
 */
export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const body = await request.json()
  const {
    tipo, fecha, descripcion, monto,
    numero, ncf, fechaVencimiento,
    proveedor, proveedorId, rncProveedor, clienteId,
    subtotal, impuesto,
    proyectoId, partidaId, destinoTipo,
    metodoPago, cuentaOrigen,
    crearFactura, crearGasto,
    observaciones,
  } = body

  if (!tipo || !['ingreso', 'egreso'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo debe ser ingreso o egreso' }, { status: 400 })
  }
  if (!descripcion?.trim()) {
    return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
  }
  const total = parseFloat(String(monto)) || 0
  if (total <= 0) {
    return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })
  }

  const wantsFactura = crearFactura ?? (!!numero || !!ncf || tipo === 'ingreso')
  const wantsGasto = crearGasto ?? (!!proyectoId && tipo === 'egreso')
  const parsedProyectoId = proyectoId ? parseInt(String(proyectoId)) : null
  const fechaDt = new Date(fecha || Date.now())

  let facturaCreada: { id: number } | null = null
  let gastoCreado: { id: number } | null = null

  const result = await prisma.$transaction(async (tx) => {
    // Crear factura si se pide
    if (wantsFactura) {
      // Generar número automático si no se envía
      let num = numero?.toString().trim()
      if (!num) {
        const prefix = tipo === 'ingreso' ? 'ING' : 'EGR'
        const year = new Date().getFullYear()
        const count = await tx.factura.count({
          where: { numero: { startsWith: `${prefix}-${year}-` } },
        })
        num = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`
      }

      const f = await tx.factura.create({
        data: {
          numero: num,
          ncf: ncf || null,
          tipo,
          fecha: fechaDt,
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
          proveedorId: proveedorId ? parseInt(String(proveedorId)) : null,
          proveedor: proveedor || null,
          rncProveedor: rncProveedor || null,
          clienteId: clienteId ? parseInt(String(clienteId)) : null,
          destinoTipo: destinoTipo || 'general',
          proyectoId: parsedProyectoId,
          descripcion: descripcion.trim(),
          subtotal: parseFloat(String(subtotal)) || total,
          impuesto: parseFloat(String(impuesto)) || 0,
          total,
          observaciones: observaciones || null,
        },
      })
      facturaCreada = f
    }

    // Crear gasto si se pide (solo si es egreso)
    if (wantsGasto && tipo === 'egreso' && parsedProyectoId) {
      const g = await tx.gastoProyecto.create({
        data: {
          proyectoId: parsedProyectoId,
          destinoTipo: destinoTipo || 'proyecto',
          fecha: fechaDt,
          tipoGasto: facturaCreada ? 'Factura' : 'Gasto menor',
          referencia: facturaCreada ? `FAC-${(facturaCreada as { id: number; numero?: string }).id}` : (numero || null),
          descripcion: descripcion.trim(),
          suplidor: proveedor || null,
          monto: total,
          metodoPago: metodoPago || 'Efectivo',
          cuentaOrigen: cuentaOrigen || null,
          partidaId: partidaId ? parseInt(String(partidaId)) : null,
          observaciones: ncf ? `NCF: ${ncf}${observaciones ? '\n' + observaciones : ''}` : (observaciones || null),
          facturaId: facturaCreada?.id ?? null,
        },
      })
      gastoCreado = g
    }

    return { factura: facturaCreada, gasto: gastoCreado }
  })

  return NextResponse.json(result, { status: 201 })
}
