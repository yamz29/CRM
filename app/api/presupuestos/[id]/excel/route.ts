import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('presupuestos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const numId = parseInt(idStr)
  if (isNaN(numId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: numId },
    include: {
      cliente: true,
      proyecto: true,
      partidas: { orderBy: { orden: 'asc' } },
      modulosMelamina: { orderBy: { orden: 'asc' } },
      titulos: { orderBy: { orden: 'asc' } },
      indirectos: { orderBy: { orden: 'asc' } },
      capitulos: {
        orderBy: { orden: 'asc' },
        include: { partidas: { orderBy: { orden: 'asc' } } },
      },
    },
  })

  if (!presupuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const empresa = await prisma.empresa.findFirst()
  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'

  // ── Calculations ──
  const subtotalBase = presupuesto.capitulos.reduce(
    (acc: number, cap: { partidas: { esNota: boolean; subtotal: number }[] }) =>
      acc + cap.partidas.reduce((s: number, p: { esNota: boolean; subtotal: number }) => s + (p.esNota ? 0 : p.subtotal), 0), 0
  )
  const indirectosActivos = presupuesto.indirectos.filter((l: { activo: boolean }) => l.activo)
  const subtotalIndirecto = indirectosActivos.reduce(
    (s: number, l: { porcentaje: number }) => s + subtotalBase * l.porcentaje / 100, 0
  )
  const subtotalObra = presupuesto.partidas.reduce((acc: number, p: { subtotal: number }) => acc + p.subtotal, 0)
  const subtotalMelamina = presupuesto.modulosMelamina.reduce(
    (acc: number, m: { subtotal: number; cantidad: number }) => acc + m.subtotal * m.cantidad, 0
  )

  const subtotalAntesDescuento = subtotalBase + subtotalIndirecto + subtotalObra + subtotalMelamina
  const montoDescuento = presupuesto.descuentoTipo === 'porcentaje'
    ? subtotalAntesDescuento * presupuesto.descuentoValor / 100
    : presupuesto.descuentoTipo === 'fijo' ? presupuesto.descuentoValor : 0
  const subtotalConDescuento = subtotalAntesDescuento - montoDescuento
  const montoItbis = presupuesto.itbisActivo ? subtotalConDescuento * presupuesto.itbisPorcentaje / 100 : 0

  // ── Build workbook ──
  const wb = XLSX.utils.book_new()

  // ━━ Sheet 1: Resumen ━━
  const resumenRows: (string | number | null)[][] = [
    [nombreEmpresa],
    [empresa?.rut ? `RNC: ${empresa.rut}` : ''],
    [],
    ['COTIZACIÓN', presupuesto.numero],
    ['Estado', presupuesto.estado],
    ['Fecha', new Date(presupuesto.createdAt).toLocaleDateString('es-DO')],
    [],
    ['CLIENTE'],
    ['Nombre', presupuesto.cliente.nombre],
    ['Teléfono', presupuesto.cliente.telefono ?? ''],
    ['Correo', presupuesto.cliente.correo ?? ''],
    ['Dirección', presupuesto.cliente.direccion ?? ''],
  ]

  if (presupuesto.proyecto) {
    resumenRows.push(
      [],
      ['PROYECTO'],
      ['Nombre', presupuesto.proyecto.nombre],
      ['Tipo', (presupuesto.proyecto as { tipoProyecto?: string }).tipoProyecto ?? ''],
      ['Ubicación', (presupuesto.proyecto as { ubicacion?: string }).ubicacion ?? ''],
    )
  }

  resumenRows.push(
    [],
    ['TOTALES'],
  )
  if (subtotalBase > 0) resumenRows.push(['Subtotal directo', subtotalBase])
  if (subtotalIndirecto > 0) resumenRows.push(['Gastos indirectos', subtotalIndirecto])
  if (subtotalObra > 0) resumenRows.push(['Subtotal partidas', subtotalObra])
  if (subtotalMelamina > 0) resumenRows.push(['Subtotal melamina', subtotalMelamina])
  if (montoDescuento > 0) {
    const descLabel = presupuesto.descuentoTipo === 'porcentaje'
      ? `Descuento (${presupuesto.descuentoValor}%)`
      : 'Descuento'
    resumenRows.push([descLabel, -montoDescuento])
  }
  if (montoItbis > 0) resumenRows.push([`ITBIS (${presupuesto.itbisPorcentaje}%)`, montoItbis])
  resumenRows.push(['TOTAL GENERAL', presupuesto.total])

  if (presupuesto.notas) {
    resumenRows.push([], ['NOTAS'], [presupuesto.notas])
  }

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  // Column widths
  wsResumen['!cols'] = [{ wch: 30 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ━━ Sheet 2: Detalle (V2 capítulos) ━━
  if (presupuesto.capitulos.length > 0) {
    const detalleRows: (string | number | null)[][] = [
      ['Título', 'Capítulo', 'Código', 'Descripción', 'Unidad', 'Cantidad', 'P. Unitario', 'Subtotal'],
    ]

    // Build titulo map
    const tituloMap: Record<number, string> = {}
    for (const t of presupuesto.titulos) {
      tituloMap[t.id] = t.nombre
    }

    for (const cap of presupuesto.capitulos) {
      const tituloNombre = cap.tituloId != null ? (tituloMap[cap.tituloId] ?? '') : ''
      for (const p of cap.partidas) {
        if (p.esNota) {
          detalleRows.push([tituloNombre, cap.nombre, p.codigo ?? '', `[NOTA] ${p.descripcion}`, '', null, null, null])
        } else {
          detalleRows.push([
            tituloNombre,
            cap.nombre,
            p.codigo ?? '',
            p.descripcion,
            p.unidad,
            p.cantidad,
            p.precioUnitario,
            p.subtotal,
          ])
        }
      }
    }

    // Add subtotal row
    detalleRows.push([])
    detalleRows.push(['', '', '', '', '', '', 'Subtotal directo:', subtotalBase])

    // Indirectos
    if (indirectosActivos.length > 0) {
      detalleRows.push([])
      detalleRows.push(['GASTOS INDIRECTOS', '', '', '', '', 'Porcentaje', '', 'Importe'])
      for (const l of indirectosActivos) {
        detalleRows.push(['', '', '', l.nombre, '', `${l.porcentaje}%`, '', subtotalBase * l.porcentaje / 100])
      }
      detalleRows.push(['', '', '', '', '', '', 'Total indirectos:', subtotalIndirecto])
    }

    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows)
    wsDetalle['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 40 },
      { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle')
  }

  // ━━ Sheet 3: Partidas legacy ━━
  if (presupuesto.partidas.length > 0) {
    const partidaRows: (string | number | null)[][] = [
      ['#', 'Descripción', 'Unidad', 'Cantidad', 'P. Unitario', 'Subtotal'],
    ]
    presupuesto.partidas.forEach((p: { descripcion: string; unidad: string; cantidad: number; precioUnitario: number; subtotal: number }, i: number) => {
      partidaRows.push([i + 1, p.descripcion, p.unidad, p.cantidad, p.precioUnitario, p.subtotal])
    })
    partidaRows.push([])
    partidaRows.push([null, null, null, null, 'Subtotal:', subtotalObra])

    const wsPartidas = XLSX.utils.aoa_to_sheet(partidaRows)
    wsPartidas['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsPartidas, 'Partidas')
  }

  // ━━ Sheet 4: Melamina legacy ━━
  if (presupuesto.modulosMelamina.length > 0) {
    const melaRows: (string | number | null)[][] = [
      ['Tipo', 'Descripción', 'Dimensiones', 'Cantidad', 'Subtotal'],
    ]
    presupuesto.modulosMelamina.forEach((m: { tipoModulo: string; descripcion: string; ancho: number; alto: number; profundidad: number; cantidad: number; subtotal: number }) => {
      melaRows.push([m.tipoModulo, m.descripcion, `${m.ancho}×${m.alto}×${m.profundidad} cm`, m.cantidad, m.subtotal * m.cantidad])
    })
    melaRows.push([])
    melaRows.push([null, null, null, 'Subtotal:', subtotalMelamina])

    const wsMela = XLSX.utils.aoa_to_sheet(melaRows)
    wsMela['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 18 }, { wch: 10 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsMela, 'Melamina')
  }

  // ── Generate buffer ──
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `${presupuesto.numero.replace(/\//g, '-')}.xlsx`
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
