import { NextRequest, NextResponse } from 'next/server'
import { getTasaAfp, getTasaSfs, getFactorHoraExtra, setTasaAfp, setTasaSfs, setFactorHoraExtra } from '@/lib/configuracion'
import { checkPermiso } from '@/lib/permisos'

export async function GET() {
  const [tasaAfp, tasaSfs, factorHoraExtra] = await Promise.all([
    getTasaAfp(),
    getTasaSfs(),
    getFactorHoraExtra(),
  ])
  return NextResponse.json({ tasaAfp, tasaSfs, factorHoraExtra })
}

export async function PUT(req: NextRequest) {
  const denied = await checkPermiso(req, 'configuracion', 'admin')
  if (denied) return denied

  try {
    const body = await req.json()
    const [tasaAfp, tasaSfs, factorHoraExtra] = await Promise.all([
      setTasaAfp(parseFloat(body.tasaAfp)),
      setTasaSfs(parseFloat(body.tasaSfs)),
      setFactorHoraExtra(parseFloat(body.factorHoraExtra)),
    ])
    return NextResponse.json({ tasaAfp, tasaSfs, factorHoraExtra })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al guardar'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
