import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('clientes', 'ver', async () => {
  const clientes = await prisma.cliente.findMany({
    include: { _count: { select: { proyectos: true, presupuestos: true } } },
    orderBy: { nombre: 'asc' },
  })

  const rows = clientes.map(c => ({
    'ID':           c.id,
    'Nombre':       c.nombre,
    'RNC / Cédula': (c as any).rnc ?? '',
    'Teléfono':     c.telefono ?? '',
    'WhatsApp':     c.whatsapp ?? '',
    'Correo':       c.correo ?? '',
    'Dirección':    c.direccion ?? '',
    'Tipo':         c.tipoCliente,
    'Fuente':       c.fuente,
    'Proyectos':    c._count.proyectos,
    'Presupuestos': c._count.presupuestos,
    'Creado':       c.createdAt.toISOString().slice(0, 10),
    'Notas':        c.notas ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  // Column widths
  ws['!cols'] = [
    { wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 28 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 13 }, { wch: 12 }, { wch: 30 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fecha = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clientes-${fecha}.xlsx"`,
    },
  })
})
