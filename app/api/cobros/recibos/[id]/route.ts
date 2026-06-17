import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied
  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  const recibo = await prisma.recibo.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true } },
      cuentaBancaria: { select: { id: true, nombre: true } },
      aplicaciones: { include: { factura: { select: { id: true, numero: true, total: true, montoPagado: true } } } },
    },
  })
  if (!recibo) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 })
  return NextResponse.json(recibo)
}
