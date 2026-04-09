import { NextRequest, NextResponse } from 'next/server'
import { getFactorCargaSocial, setFactorCargaSocial } from '@/lib/configuracion'
import { checkPermiso } from '@/lib/permisos'

export async function GET() {
  const factor = await getFactorCargaSocial()
  return NextResponse.json({ factor })
}

export async function PUT(req: NextRequest) {
  const denied = await checkPermiso(req, 'configuracion', 'admin')
  if (denied) return denied

  try {
    const body = await req.json()
    const valor = parseFloat(body.factor)
    const factor = await setFactorCargaSocial(valor)
    return NextResponse.json({ factor })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al guardar'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
