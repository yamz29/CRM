import { NextRequest, NextResponse } from 'next/server'
import { checkPermiso } from '@/lib/permisos'
import { cargarInforme } from '@/lib/informe-economico-data'

/**
 * Informe Económico (Resultado) — base caja, RD$.
 * Devuelve KPIs (período actual y anterior), gasto por renglón,
 * rentabilidad por proyecto y evolución mensual.
 * La lógica de carga vive en lib/informe-economico-data.ts.
 */
export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const sp = request.nextUrl.searchParams
  const desdeStr = sp.get('desde')
  const hastaStr = sp.get('hasta')
  if (!desdeStr || !hastaStr) {
    return NextResponse.json({ error: 'Faltan parámetros desde/hasta' }, { status: 400 })
  }
  if (isNaN(new Date(desdeStr).getTime()) || isNaN(new Date(hastaStr).getTime())) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }

  const { data } = await cargarInforme(desdeStr, hastaStr)
  return NextResponse.json(data)
}
