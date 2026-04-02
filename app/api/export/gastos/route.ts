import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET() {
  const gastos = await prisma.gastoProyecto.findMany({
    include: {
      proyecto: { select: { nombre: true } },
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
  })

  const rows = gastos.map(g => ({
    'ID':          g.id,
    'Fecha':       new Date(g.fecha).toISOString().slice(0, 10),
    'Descripción': g.descripcion,
    'Categoría':   g.categoria ?? '',
    'Monto':       g.monto,
    'Estado':      g.estado,
    'Tipo':        g.destinoTipo,
    'Proyecto':    g.proyecto?.nombre ?? '',
    'Suplidor':    g.suplidor ?? '',
    'Referencia':  g.referencia ?? '',
    'Notas':       g.observaciones ?? '',
    'Creado':      g.createdAt.toISOString().slice(0, 10),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 16 },
    { wch: 30 }, { wch: 12 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="gastos-${fecha}.xlsx"`,
    },
  })
}
