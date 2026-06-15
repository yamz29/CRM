import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'
import {
  MONEDA_DEFAULT, filtrarGastos, agruparPorDestino, agruparPorMes,
  gastosEnOtrasMonedas, agruparPorProyecto, presetRango, DESTINO_LABEL,
  type GastoInput,
} from '@/lib/gastos-informe'

export const GET = withPermiso('gastos', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const moneda     = searchParams.get('moneda') || MONEDA_DEFAULT
  const fallback   = presetRango('este-anio')
  const desde      = searchParams.get('desde') || fallback.desde
  const hasta      = searchParams.get('hasta') || fallback.hasta
  const destino    = searchParams.get('destino') || null
  const proyectoId = searchParams.get('proyectoId')

  const gastosRaw = await prisma.gastoProyecto.findMany({
    include: {
      proyecto: { select: { id: true, nombre: true } },
      partida:  { select: { id: true, descripcion: true, codigo: true } },
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
  })

  const gastos = gastosRaw as unknown as (GastoInput & {
    fecha: Date; categoria: string | null; suplidor: string | null; descripcion: string
  })[]

  const filtrados = filtrarGastos(gastos, {
    moneda, desde, hasta, destino,
    proyectoId: proyectoId ? Number(proyectoId) : null,
  })

  const otrasMonedas = gastosEnOtrasMonedas(gastos, {
    moneda, desde, hasta, destino,
    proyectoId: proyectoId ? Number(proyectoId) : null,
  })

  const wb = XLSX.utils.book_new()

  // Hoja Resumen
  const total = filtrados.reduce((s, g) => s + g.monto, 0)
  const resumenRows: (string | number)[][] = [
    ['Informe de Gastos'],
    ['Moneda', moneda],
    ['Desde', desde, 'Hasta', hasta],
    ['Total del periodo', total],
    ['# de gastos', filtrados.length],
    ['Gastos en otra moneda no incluidos', otrasMonedas],
    [],
    ['Por destino', 'Total', '% del total', '# gastos'],
    ...agruparPorDestino(filtrados).map(d => [d.label, d.total, Number((d.pct * 100).toFixed(1)), d.count]),
    [],
    ['Por mes', 'Total'],
    ...agruparPorMes(filtrados).map(m => [m.label, m.total]),
    [],
    ['Por proyecto', 'Total', '# gastos'],
    ...agruparPorProyecto(filtrados).map(p => [p.nombre, p.total, p.count]),
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Hoja Detalle
  const detalleRows = filtrados.map(g => ({
    'Fecha':       new Date(g.fecha).toISOString().slice(0, 10),
    'Destino':     DESTINO_LABEL[g.destinoTipo] ?? g.destinoTipo,
    'Proyecto':    g.proyecto?.nombre ?? '',
    'Descripción': g.descripcion ?? '',
    'Categoría':   g.categoria ?? '',
    'Suplidor':    g.suplidor ?? '',
    'Moneda':      g.moneda,
    'Monto':       g.monto,
    'Estado':      g.estado,
  }))
  const wsDetalle = XLSX.utils.json_to_sheet(detalleRows)
  wsDetalle['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 16 }, { wch: 20 }, { wch: 8 }, { wch: 14 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fechaArchivo = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="informe-gastos-${fechaArchivo}.xlsx"`,
    },
  })
})
