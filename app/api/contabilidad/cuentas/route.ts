import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  try {
    const cuentas = await prisma.cuentaBancaria.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { movimientos: true, pagos: true } },
      },
    })

    // Calculate current balance for each account
    const cuentasConSaldo = await Promise.all(
      cuentas.map(async (c) => {
        const agg = await prisma.movimientoBancario.groupBy({
          by: ['tipo'],
          where: { cuentaBancariaId: c.id },
          _sum: { monto: true },
        })
        let saldo = c.saldoInicial
        for (const g of agg) {
          if (g.tipo === 'credito') saldo += g._sum.monto || 0
          else saldo -= g._sum.monto || 0
        }
        return { ...c, saldoActual: saldo }
      })
    )

    return NextResponse.json(cuentasConSaldo)
  } catch (error) {
    console.error('Error fetching cuentas:', error)
    return NextResponse.json({ error: 'Error al obtener cuentas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()
    const { nombre, banco, numeroCuenta, tipoCuenta, moneda, saldoInicial } = body

    if (!nombre?.trim() || !banco?.trim()) {
      return NextResponse.json({ error: 'Nombre y banco son requeridos' }, { status: 400 })
    }

    const cuenta = await prisma.cuentaBancaria.create({
      data: {
        nombre: nombre.trim(),
        banco: banco.trim(),
        numeroCuenta: numeroCuenta || null,
        tipoCuenta: tipoCuenta || 'corriente',
        moneda: moneda || 'RD$',
        saldoInicial: parseFloat(String(saldoInicial)) || 0,
      },
    })

    return NextResponse.json(cuenta, { status: 201 })
  } catch (error) {
    console.error('Error creating cuenta:', error)
    return NextResponse.json({ error: 'Error al crear cuenta' }, { status: 500 })
  }
}
