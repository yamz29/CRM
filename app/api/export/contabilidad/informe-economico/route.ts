import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'
import { MONEDA_DEFAULT, presetRango, DESTINO_LABEL } from '@/lib/gastos-informe'
import { cargarInforme } from '@/lib/informe-economico-data'

export const GET = withPermiso('contabilidad', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const fallback = presetRango('este-mes')
  const desde = searchParams.get('desde') || fallback.desde
  const hasta = searchParams.get('hasta') || fallback.hasta

  const { data, actual } = await cargarInforme(desde, hasta)
  const { kpis, porRenglon, porProyecto, porMes } = data

  const wb = XLSX.utils.book_new()

  // ── Hoja Resumen ──
  const resumenRows: (string | number)[][] = [
    ['Informe Económico (Resultado)'],
    ['Moneda', MONEDA_DEFAULT],
    ['Desde', desde, 'Hasta', hasta],
    [],
    ['Ingresos (cobrado)', kpis.ingresos],
    ['Gastos', kpis.gastos],
    ['Resultado', kpis.resultado],
    ['Margen %', kpis.margen === null ? 'N/A' : Number((kpis.margen * 100).toFixed(1))],
    ['Gastos en otra moneda no incluidos', data.otrasMonedas.count],
    [],
    ['Gasto por renglón', 'Total', '% del gasto'],
    ...porRenglon.map(r => [r.label, r.total, Number((r.pct * 100).toFixed(1))]),
    [],
    ['Rentabilidad por proyecto', 'Ingresos', 'Gastos', 'Resultado', 'Margen %'],
    ...porProyecto.map(p => [
      p.nombre, p.ingresos, p.gastos, p.resultado,
      p.margen === null ? 'N/A' : Number((p.margen * 100).toFixed(1)),
    ]),
    [],
    ['Evolución mensual', 'Ingresos', 'Gastos', 'Resultado'],
    ...porMes.map(m => [m.label, m.ingresos, m.gastos, m.resultado]),
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ── Hoja Detalle (movimientos del período) ──
  const detalle = [
    ...actual.ingresos.map(i => ({
      'Fecha': i.fecha.slice(0, 10),
      'Tipo': 'Ingreso',
      'Renglón': '',
      'Proyecto': i.proyectoNombre ?? '',
      'Partida': '',
      'Monto': i.monto,
    })),
    ...actual.gastos.map(g => ({
      'Fecha': g.fecha.slice(0, 10),
      'Tipo': 'Gasto',
      'Renglón': DESTINO_LABEL[g.destinoTipo] ?? g.destinoTipo,
      'Proyecto': g.proyectoNombre ?? '',
      'Partida': g.partida ? `${g.partida.codigo ? g.partida.codigo + ' · ' : ''}${g.partida.descripcion}` : '',
      'Monto': g.monto,
    })),
  ].sort((a, b) => a.Fecha.localeCompare(b.Fecha))

  const wsDetalle = XLSX.utils.json_to_sheet(detalle)
  wsDetalle['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 25 }, { wch: 30 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fechaArchivo = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="informe-economico-${fechaArchivo}.xlsx"`,
    },
  })
})
