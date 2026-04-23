import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('proyectos', 'ver', async () => {
  const proyectos = await prisma.proyecto.findMany({
    include: {
      cliente: { select: { nombre: true } },
      _count: { select: { presupuestos: true, gastos: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = proyectos.map(p => ({
    'ID':                  p.id,
    'Nombre':              p.nombre,
    'Cliente':             p.cliente.nombre,
    'Tipo':                p.tipoProyecto,
    'Ubicación':           p.ubicacion ?? '',
    'Estado':              p.estado,
    'Responsable':         p.responsable ?? '',
    'Fecha Inicio':        p.fechaInicio ? new Date(p.fechaInicio).toISOString().slice(0, 10) : '',
    'Fecha Estimada':      p.fechaEstimada ? new Date(p.fechaEstimada).toISOString().slice(0, 10) : '',
    'Presupuesto Estimado': p.presupuestoEstimado ?? '',
    'Presupuestos':        p._count.presupuestos,
    'Gastos':              p._count.gastos,
    'Descripción':         p.descripcion ?? '',
    'Creado':              p.createdAt.toISOString().slice(0, 10),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 6 }, { wch: 30 }, { wch: 25 }, { wch: 16 }, { wch: 25 },
    { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 13 }, { wch: 8 }, { wch: 35 }, { wch: 12 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="proyectos-${fecha}.xlsx"`,
    },
  })
})
