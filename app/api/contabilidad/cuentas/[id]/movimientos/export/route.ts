import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import * as XLSX from 'xlsx'

// GET /api/contabilidad/cuentas/[id]/movimientos/export
// Query params (todos opcionales):
//   desde=YYYY-MM-DD   hasta=YYYY-MM-DD
//   estado=sin|conciliados
//   tipo=credito|debito
//   q=texto (busca en descripción y referencia)
//
// Devuelve un .xlsx con los movimientos filtrados.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const { id: idStr } = await params
  const cuentaId = parseInt(idStr)
  if (isNaN(cuentaId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const cuenta = await prisma.cuentaBancaria.findUnique({
    where: { id: cuentaId },
    select: { id: true, nombre: true, banco: true, numeroCuenta: true },
  })
  if (!cuenta) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
  }

  const sp = request.nextUrl.searchParams
  const desde = sp.get('desde')
  const hasta = sp.get('hasta')
  const estado = sp.get('estado') // 'sin' | 'conciliados'
  const tipo = sp.get('tipo')     // 'credito' | 'debito'
  const q = sp.get('q')?.trim()

  type WhereClause = {
    cuentaBancariaId: number
    fecha?: { gte?: Date; lte?: Date }
    conciliado?: boolean
    tipo?: string
    OR?: Array<{ descripcion?: { contains: string; mode: 'insensitive' } ; referencia?: { contains: string; mode: 'insensitive' } }>
  }
  const where: WhereClause = { cuentaBancariaId: cuentaId }

  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde + 'T00:00:00')
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59')
  }
  if (estado === 'sin') where.conciliado = false
  if (estado === 'conciliados') where.conciliado = true
  if (tipo === 'credito' || tipo === 'debito') where.tipo = tipo
  if (q) {
    where.OR = [
      { descripcion: { contains: q, mode: 'insensitive' } },
      { referencia: { contains: q, mode: 'insensitive' } },
    ]
  }

  const movimientos = await prisma.movimientoBancario.findMany({
    where,
    include: {
      factura: {
        select: { id: true, numero: true, ncf: true, proveedor: true, total: true },
      },
    },
    orderBy: { fecha: 'asc' },
  })

  // Construir hoja Excel
  const rows = movimientos.map(m => ({
    'Fecha': m.fecha.toISOString().slice(0, 10),
    'Tipo': m.tipo === 'credito' ? 'Crédito' : 'Débito',
    'Monto': m.monto,
    'Descripción': m.descripcion,
    'Referencia': m.referencia ?? '',
    'Conciliado': m.conciliado ? 'Sí' : 'No',
    'Factura': m.factura?.numero ?? '',
    'NCF': m.factura?.ncf ?? '',
    'Proveedor / Cliente': m.factura?.proveedor ?? '',
    'Total factura': m.factura?.total ?? '',
  }))

  // Fila resumen al final
  const totalCreditos = movimientos.filter(m => m.tipo === 'credito').reduce((s, m) => s + m.monto, 0)
  const totalDebitos = movimientos.filter(m => m.tipo === 'debito').reduce((s, m) => s + m.monto, 0)

  const workbook = XLSX.utils.book_new()

  // Hoja 1: Movimientos
  const ws1 = XLSX.utils.json_to_sheet(rows, {
    header: ['Fecha','Tipo','Monto','Descripción','Referencia','Conciliado','Factura','NCF','Proveedor / Cliente','Total factura']
  })
  // Ancho de columnas
  ws1['!cols'] = [
    { wch: 12 }, // Fecha
    { wch: 10 }, // Tipo
    { wch: 14 }, // Monto
    { wch: 50 }, // Descripción
    { wch: 20 }, // Referencia
    { wch: 12 }, // Conciliado
    { wch: 16 }, // Factura
    { wch: 18 }, // NCF
    { wch: 30 }, // Proveedor
    { wch: 14 }, // Total factura
  ]

  // Formato de moneda en columnas Monto (C) y Total factura (J).
  // SheetJS community edition soporta number format vía cell.z sin necesidad
  // de la licencia Pro. `"RD$"\ #,##0.00` muestra "RD$ 1,234.56".
  const MONEY_FMT = '"RD$ "#,##0.00;[Red]-"RD$ "#,##0.00'
  const range = XLSX.utils.decode_range(ws1['!ref'] ?? 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    // Columna C (Monto, índice 2) y J (Total factura, índice 9)
    for (const c of [2, 9]) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws1[addr]
      if (cell && typeof cell.v === 'number') {
        cell.z = MONEY_FMT
        cell.t = 'n'
      }
    }
  }

  // Congelar primera fila (header siempre visible al scrollear) + auto-filter.
  ws1['!views'] = [{ ySplit: 1 }]
  ws1['!autofilter'] = { ref: ws1['!ref'] ?? 'A1' }

  XLSX.utils.book_append_sheet(workbook, ws1, 'Movimientos')

  // Hoja 2: Resumen
  const resumen = [
    { Concepto: 'Cuenta',             Valor: `${cuenta.nombre} — ${cuenta.banco}` },
    { Concepto: 'Número de cuenta',   Valor: cuenta.numeroCuenta ?? '' },
    { Concepto: 'Filtro desde',       Valor: desde ?? '—' },
    { Concepto: 'Filtro hasta',       Valor: hasta ?? '—' },
    { Concepto: 'Filtro estado',      Valor: estado ?? 'Todos' },
    { Concepto: 'Filtro tipo',        Valor: tipo ?? 'Todos' },
    { Concepto: 'Filtro búsqueda',    Valor: q ?? '' },
    { Concepto: '' ,                  Valor: '' },
    { Concepto: 'Total movimientos',  Valor: movimientos.length },
    { Concepto: 'Total créditos',     Valor: totalCreditos },
    { Concepto: 'Total débitos',      Valor: totalDebitos },
    { Concepto: 'Balance (CR - DB)',  Valor: totalCreditos - totalDebitos },
    { Concepto: 'Conciliados',        Valor: movimientos.filter(m => m.conciliado).length },
    { Concepto: 'Sin conciliar',      Valor: movimientos.filter(m => !m.conciliado).length },
    { Concepto: '' ,                  Valor: '' },
    { Concepto: 'Exportado el',       Valor: new Date().toISOString() },
  ]
  const ws2 = XLSX.utils.json_to_sheet(resumen, { header: ['Concepto', 'Valor'] })
  ws2['!cols'] = [{ wch: 24 }, { wch: 44 }]
  // Formato moneda en las filas de totales (índices dependen del orden del array)
  const MONEY_ROWS = [9, 10, 11] // totalCreditos, totalDebitos, balance (0-indexed + header)
  for (const r of MONEY_ROWS) {
    const addr = XLSX.utils.encode_cell({ r: r + 1, c: 1 }) // +1 por header
    const cell = ws2[addr]
    if (cell && typeof cell.v === 'number') {
      cell.z = MONEY_FMT
      cell.t = 'n'
    }
  }
  XLSX.utils.book_append_sheet(workbook, ws2, 'Resumen')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  // Nombre de archivo con cuenta + rango de fechas
  const slug = cuenta.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
  const rango = desde && hasta ? `-${desde}_${hasta}` : desde ? `-desde-${desde}` : hasta ? `-hasta-${hasta}` : ''
  const filename = `conciliacion-${slug}${rango}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
