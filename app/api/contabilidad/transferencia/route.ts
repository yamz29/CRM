import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const { cuentaOrigenId, cuentaDestinoId, monto, fecha, descripcion, referencia } = await request.json()

    if (!cuentaOrigenId || !cuentaDestinoId) {
      return NextResponse.json({ error: 'Seleccione cuenta origen y destino' }, { status: 400 })
    }
    if (cuentaOrigenId === cuentaDestinoId) {
      return NextResponse.json({ error: 'Las cuentas deben ser diferentes' }, { status: 400 })
    }
    const montoNum = parseFloat(monto)
    if (!montoNum || montoNum <= 0) {
      return NextResponse.json({ error: 'Monto debe ser mayor a 0' }, { status: 400 })
    }

    // Verify both accounts exist
    const [origen, destino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({ where: { id: parseInt(cuentaOrigenId) } }),
      prisma.cuentaBancaria.findUnique({ where: { id: parseInt(cuentaDestinoId) } }),
    ])
    if (!origen) return NextResponse.json({ error: 'Cuenta origen no encontrada' }, { status: 404 })
    if (!destino) return NextResponse.json({ error: 'Cuenta destino no encontrada' }, { status: 404 })

    const fechaDate = fecha ? new Date(fecha) : new Date()
    const desc = descripcion || `Transferencia ${origen.nombre} → ${destino.nombre}`
    const ref = referencia || `TRF-${Date.now()}`

    // Create both movements in a transaction
    const [debito, credito] = await prisma.$transaction([
      // Debit from origin (money leaves)
      prisma.movimientoBancario.create({
        data: {
          cuentaBancariaId: origen.id,
          fecha: fechaDate,
          tipo: 'debito',
          monto: montoNum,
          descripcion: desc,
          referencia: ref,
          conciliado: true,
        },
      }),
      // Credit to destination (money arrives)
      prisma.movimientoBancario.create({
        data: {
          cuentaBancariaId: destino.id,
          fecha: fechaDate,
          tipo: 'credito',
          monto: montoNum,
          descripcion: desc,
          referencia: ref,
          conciliado: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      debito,
      credito,
      message: `Transferencia de ${montoNum.toLocaleString('en-US', { minimumFractionDigits: 2 })} de ${origen.nombre} a ${destino.nombre}`,
    })
  } catch (error: any) {
    console.error('Error en transferencia:', error)
    return NextResponse.json({ error: `Error al procesar transferencia: ${error.message}` }, { status: 500 })
  }
}
