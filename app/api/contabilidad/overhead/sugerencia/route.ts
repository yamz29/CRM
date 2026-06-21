import { NextRequest, NextResponse } from 'next/server'
import { withPermiso } from '@/lib/with-permiso'
import { proyectosCandidatosDelMes } from '../route'
import { senalesDelMes, pesosSugerencia, diasDelMes } from '@/lib/overhead-data'
import { sugerirReparto } from '@/lib/overhead'

/**
 * GET /api/contabilidad/overhead/sugerencia?anio=YYYY&mes=M
 *
 * Devuelve el % de reparto sugerido por proyecto (con desglose por señal) para
 * el mes, sobre el mismo conjunto de proyectos candidatos que el GET principal.
 * NO persiste nada.
 */
export const GET = withPermiso('contabilidad', 'ver', async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const anio = parseInt(sp.get('anio') ?? '')
  const mes = parseInt(sp.get('mes') ?? '')
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Parámetros anio/mes inválidos' }, { status: 400 })
  }

  const candidatos = await proyectosCandidatosDelMes(anio, mes)
  if (candidatos.length === 0) {
    return NextResponse.json({ anio, mes, sugerencias: [] })
  }

  const [senales, pesos] = await Promise.all([
    senalesDelMes(anio, mes, candidatos.map(c => c.id)),
    pesosSugerencia(),
  ])

  const sugerencias = sugerirReparto(senales, diasDelMes(anio, mes), pesos)
  return NextResponse.json({ anio, mes, sugerencias })
})
