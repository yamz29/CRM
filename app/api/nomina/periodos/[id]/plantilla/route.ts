import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import * as XLSX from 'xlsx'

type Ctx = { params: Promise<{ id: string }> }

function esAdmin(req: NextRequest) {
  return req.headers.get('x-user-rol') === 'Admin'
}

export const GET = withPermiso('nomina', 'ver', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const periodo = await prisma.periodoNomina.findUnique({
    where: { id },
    include: { lineas: { include: { empleado: true }, orderBy: { id: 'asc' } } },
  })
  if (!periodo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const admin = esAdmin(request)
  const inicio = periodo.fechaInicio.toISOString().slice(0, 10)
  const fin = periodo.fechaFin.toISOString().slice(0, 10)

  const headers = [
    'empleado', 'cédula', 'cargo', 'banco', 'tipo_cuenta', 'numero_cuenta',
    'salario_base', 'horas_extra', 'valor_hora_extra', 'bonificaciones',
    'afp', 'sfs', 'otros_descuentos', 'motivo_descuento', 'total_bruto', 'total_a_pagar',
  ]
  const filas = periodo.lineas.map((l) => [
    l.empleado.nombre, l.empleado.cedula ?? '', l.empleado.cargo ?? '',
    l.empleado.banco ?? '', l.empleado.tipoCuenta ?? '', l.empleado.numeroCuenta ?? '',
    l.salarioBase, l.horasExtra, l.valorHoraExtra, l.bonificaciones,
    l.afp, l.sfs, l.otrosDescuentos, l.motivoDescuento ?? '',
    l.totalBruto, l.totalNeto,
  ])
  const totalAPagar = periodo.lineas.reduce((acc, l) => acc + l.totalNeto, 0)
  filas.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'TOTAL', '', Number(totalAPagar.toFixed(2))])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...filas])
  ws['!cols'] = [
    { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 18 },
    { wch: 13 }, { wch: 11 }, { wch: 15 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 13 }, { wch: 14 },
  ]
  ws['!autofilter'] = { ref: `A1:P${filas.length}` }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pago de nómina')

  // Sin permiso admin no se exporta el detalle salarial (campo sensible)
  if (!admin) {
    const wsLimitada = XLSX.utils.aoa_to_sheet([
      ['empleado', 'cédula', 'banco', 'tipo_cuenta', 'numero_cuenta'],
      ...periodo.lineas.map((l) => [
        l.empleado.nombre, l.empleado.cedula ?? '', l.empleado.banco ?? '',
        l.empleado.tipoCuenta ?? '', l.empleado.numeroCuenta ?? '',
      ]),
    ])
    const wbLimitado = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wbLimitado, wsLimitada, 'Datos bancarios')
    const buffer = XLSX.write(wbLimitado, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="nomina-${inicio}-al-${fin}.xlsx"`,
      },
    })
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="nomina-${inicio}-al-${fin}.xlsx"`,
    },
  })
})
