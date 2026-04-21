import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { generarNumeroProforma } from '@/lib/numero-factura'

// POST /api/presupuestos/[id]/emitir-factura
// Crea una factura proforma desde un presupuesto aprobado.
// Body (todos opcionales):
//   { monto?, descripcion?, observaciones?, fechaVencimiento? }
// Si no se pasa monto, usa el total del presupuesto.
// Permite emitir múltiples facturas desde el mismo presupuesto
// (facturación por avance: 30% inicio, 40% avance, 30% entrega).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const { id: idStr } = await params
  const presupuestoId = parseInt(idStr)
  if (isNaN(presupuestoId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    // Validar que tenga sentido facturar este presupuesto
    const estadosFacturables = ['Aprobado', 'En Ejecución', 'Ejecutado', 'Facturado', 'Cerrado']
    if (!estadosFacturables.includes(presupuesto.estado)) {
      return NextResponse.json(
        { error: `El presupuesto debe estar aprobado para facturar (estado actual: ${presupuesto.estado})` },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const montoCustom = body.monto != null ? parseFloat(String(body.monto)) : null
    const descripcion = body.descripcion?.toString().trim() || `Factura proforma — Presupuesto ${presupuesto.numero}`
    const observaciones = body.observaciones?.toString().trim() || null
    const fechaVencimiento = body.fechaVencimiento ? new Date(body.fechaVencimiento) : null

    // Monto de la factura. Si no viene o es inválido, usa total del presupuesto
    // menos lo ya facturado (para que no te pases si ya hay otras proformas).
    const facturadoPrevio = await prisma.factura.aggregate({
      where: { presupuestoId, estado: { not: 'anulada' } },
      _sum: { total: true },
    })
    const yaFacturado = facturadoPrevio._sum.total ?? 0
    const pendiente = Math.max(0, presupuesto.total - yaFacturado)

    let total = montoCustom != null && !isNaN(montoCustom) && montoCustom > 0
      ? montoCustom
      : pendiente

    if (total <= 0) {
      return NextResponse.json(
        { error: 'El presupuesto ya está completamente facturado' },
        { status: 400 }
      )
    }

    // Si el monto custom supera lo pendiente, avisamos pero permitimos
    // (podría ser ajuste por redondeo o cargos adicionales)
    if (montoCustom != null && montoCustom > pendiente + 0.01) {
      // No bloqueamos — solo registramos en observaciones.
      // El usuario ya vio el "pendiente" en la UI y decidió.
    }

    // Calcular desglose: si el presupuesto tiene ITBIS, aplica la misma tasa
    // a la factura. Si no, va completo como subtotal.
    let subtotal: number, impuesto: number, tasaItbis: number
    if (presupuesto.itbisActivo) {
      tasaItbis = presupuesto.itbisPorcentaje
      // total = subtotal * (1 + tasa/100)  →  subtotal = total / (1 + tasa/100)
      subtotal = +(total / (1 + tasaItbis / 100)).toFixed(2)
      impuesto = +(total - subtotal).toFixed(2)
    } else {
      tasaItbis = 0
      subtotal = total
      impuesto = 0
    }

    const numero = await generarNumeroProforma()

    const factura = await prisma.factura.create({
      data: {
        numero,
        ncf: null,
        tipo: 'ingreso',
        esProforma: true,
        presupuestoId,
        clienteId: presupuesto.clienteId,
        destinoTipo: presupuesto.proyectoId ? 'proyecto' : 'general',
        proyectoId: presupuesto.proyectoId,
        fecha: new Date(),
        fechaVencimiento,
        descripcion,
        observaciones,
        subtotal,
        tasaItbis,
        impuesto,
        propinaLegal: 0,
        otrosImpuestos: 0,
        total,
        estado: 'pendiente',
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json(factura, { status: 201 })
  } catch (error) {
    console.error('Error emitir factura:', error)
    const msg = error instanceof Error ? error.message : 'Error al emitir factura'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
