import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const cuentaId = parseInt((await params).id)
  if (isNaN(cuentaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const sp = request.nextUrl.searchParams
  const conciliado = sp.get('conciliado')
  const desde = sp.get('desde')
  const hasta = sp.get('hasta')

  const where: any = { cuentaBancariaId: cuentaId }
  if (conciliado === 'true') where.conciliado = true
  if (conciliado === 'false') where.conciliado = false
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59')
  }

  try {
    const movimientos = await prisma.movimientoBancario.findMany({
      where,
      include: { factura: { select: { id: true, numero: true, tipo: true, proveedor: true } } },
      orderBy: { fecha: 'desc' },
    })
    return NextResponse.json(movimientos)
  } catch (error) {
    console.error('Error fetching movimientos:', error)
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const cuentaId = parseInt((await params).id)
  if (isNaN(cuentaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const { fecha, tipo, monto, descripcion, referencia, facturaId } = body

    if (!tipo || !['debito', 'credito'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo debe ser debito o credito' }, { status: 400 })
    }
    const montoNum = parseFloat(String(monto))
    if (!montoNum || montoNum <= 0) {
      return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })
    }
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: 'Descripción es requerida' }, { status: 400 })
    }

    const movimiento = await prisma.movimientoBancario.create({
      data: {
        cuentaBancariaId: cuentaId,
        fecha: new Date(fecha || Date.now()),
        tipo,
        monto: montoNum,
        descripcion: descripcion.trim(),
        referencia: referencia || null,
        conciliado: !!facturaId,
        facturaId: facturaId ? parseInt(String(facturaId)) : null,
      },
      include: { factura: { select: { id: true, numero: true, tipo: true } } },
    })

    return NextResponse.json(movimiento, { status: 201 })
  } catch (error) {
    console.error('Error creating movimiento:', error)
    return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 })
  }
}
