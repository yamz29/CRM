import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const { nombre, banco, numeroCuenta, tipoCuenta, moneda, saldoInicial, activa } = body

    const cuenta = await prisma.cuentaBancaria.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(banco !== undefined && { banco: banco.trim() }),
        ...(numeroCuenta !== undefined && { numeroCuenta: numeroCuenta || null }),
        ...(tipoCuenta !== undefined && { tipoCuenta }),
        ...(moneda !== undefined && { moneda }),
        ...(saldoInicial !== undefined && { saldoInicial: parseFloat(String(saldoInicial)) || 0 }),
        ...(activa !== undefined && { activa }),
      },
    })

    return NextResponse.json(cuenta)
  } catch (error) {
    console.error('Error updating cuenta:', error)
    return NextResponse.json({ error: 'Error al actualizar cuenta' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(_req, 'contabilidad', 'admin')
  if (denied) return denied

  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    // Check for non-conciliated movements
    const pendientes = await prisma.movimientoBancario.count({
      where: { cuentaBancariaId: id, conciliado: false },
    })
    if (pendientes > 0) {
      return NextResponse.json(
        { error: `No se puede desactivar: tiene ${pendientes} movimiento(s) sin conciliar` },
        { status: 409 }
      )
    }

    // Soft delete — mark as inactive
    await prisma.cuentaBancaria.update({
      where: { id },
      data: { activa: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cuenta:', error)
    return NextResponse.json({ error: 'Error al desactivar cuenta' }, { status: 500 })
  }
}
