import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'
import { parseFlexibleDate, parseFlexibleNumber } from '@/lib/csv'

// Expected row shape — keys are the canonical column names produced by the
// client after normalizing header aliases.
interface RawRow {
  numero?: string
  ncf?: string
  tipo?: string
  fecha?: string
  fecha_vencimiento?: string
  proveedor?: string
  rnc_proveedor?: string
  descripcion?: string
  subtotal?: string
  impuesto?: string
  total?: string
  destino_tipo?: string
  proyecto_nombre?: string
  observaciones?: string
}

interface ValidatedRow {
  index: number          // 1-based row number for the user (excludes header)
  ok: boolean
  errors: string[]
  data?: {
    numero: string
    ncf: string | null
    tipo: 'egreso' // we only support egreso for now
    fecha: Date
    fechaVencimiento: Date | null
    proveedor: string | null
    rncProveedor: string | null
    descripcion: string | null
    subtotal: number
    impuesto: number
    total: number
    destinoTipo: string
    proyectoId: number | null
    observaciones: string | null
  }
  raw: RawRow
}

function validateRow(
  row: RawRow,
  index: number,
  proyectosByName: Map<string, number>,
  numerosExistentes: Set<string>,
  numerosEnLote: Map<string, number>
): ValidatedRow {
  const errors: string[] = []

  const numero = row.numero?.trim() || ''
  if (!numero) errors.push('Falta el número de factura')

  // Duplicates within DB
  if (numero && numerosExistentes.has(numero.toLowerCase())) {
    errors.push(`Ya existe una factura con número "${numero}"`)
  }
  // Duplicates within the same CSV
  if (numero) {
    const prev = numerosEnLote.get(numero.toLowerCase())
    if (prev !== undefined) {
      errors.push(`Número "${numero}" duplicado en la fila ${prev}`)
    } else {
      numerosEnLote.set(numero.toLowerCase(), index)
    }
  }

  const fecha = parseFlexibleDate(row.fecha)
  if (!fecha) errors.push('Fecha inválida o faltante (use YYYY-MM-DD o DD/MM/YYYY)')

  const fechaVencimiento = row.fecha_vencimiento?.trim()
    ? parseFlexibleDate(row.fecha_vencimiento)
    : null
  if (row.fecha_vencimiento?.trim() && !fechaVencimiento) {
    errors.push('Fecha de vencimiento inválida')
  }

  // Numbers
  const subtotal = row.subtotal?.trim() ? parseFlexibleNumber(row.subtotal) : 0
  if (row.subtotal?.trim() && isNaN(subtotal)) errors.push('Subtotal no es un número válido')

  const impuesto = row.impuesto?.trim() ? parseFlexibleNumber(row.impuesto) : 0
  if (row.impuesto?.trim() && isNaN(impuesto)) errors.push('Impuesto no es un número válido')

  let total = row.total?.trim() ? parseFlexibleNumber(row.total) : NaN
  if (row.total?.trim() && isNaN(total)) errors.push('Total no es un número válido')
  if (isNaN(total)) total = (isNaN(subtotal) ? 0 : subtotal) + (isNaN(impuesto) ? 0 : impuesto)

  // Destino + proyecto
  const destinoTipoRaw = (row.destino_tipo?.trim() || 'general').toLowerCase()
  const destinoTipo = ['proyecto', 'oficina', 'taller', 'general'].includes(destinoTipoRaw)
    ? destinoTipoRaw
    : 'general'
  if (row.destino_tipo?.trim() && destinoTipo !== destinoTipoRaw) {
    errors.push(`destino_tipo "${row.destino_tipo}" inválido (use: proyecto, oficina, taller o general)`)
  }

  let proyectoId: number | null = null
  const proyectoNombre = row.proyecto_nombre?.trim()
  if (destinoTipo === 'proyecto') {
    if (!proyectoNombre) {
      errors.push('destino_tipo=proyecto requiere proyecto_nombre')
    } else {
      const found = proyectosByName.get(proyectoNombre.toLowerCase())
      if (!found) {
        errors.push(`No se encontró proyecto con nombre "${proyectoNombre}"`)
      } else {
        proyectoId = found
      }
    }
  } else if (proyectoNombre) {
    // Allow specifying a project even on non-project destino — just resolve it
    const found = proyectosByName.get(proyectoNombre.toLowerCase())
    if (found) proyectoId = found
  }

  if (errors.length > 0 || !fecha || !numero) {
    return { index, ok: false, errors, raw: row }
  }

  return {
    index,
    ok: true,
    errors: [],
    data: {
      numero,
      ncf: row.ncf?.trim() || null,
      tipo: 'egreso',
      fecha: fecha!,
      fechaVencimiento,
      proveedor: row.proveedor?.trim() || null,
      rncProveedor: row.rnc_proveedor?.trim() || null,
      descripcion: row.descripcion?.trim() || null,
      subtotal: isNaN(subtotal) ? 0 : subtotal,
      impuesto: isNaN(impuesto) ? 0 : impuesto,
      total,
      destinoTipo,
      proyectoId,
      observaciones: row.observaciones?.trim() || null,
    },
    raw: row,
  }
}

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const body = await request.json()
    const rows: RawRow[] = Array.isArray(body.rows) ? body.rows : []
    const dryRun: boolean = !!body.dryRun

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 })
    }
    if (rows.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
    }

    // Load proyectos for name resolution (case-insensitive)
    const proyectos = await prisma.proyecto.findMany({
      where: { estado: { notIn: ['Cancelado', 'Cerrado'] } },
      select: { id: true, nombre: true },
    })
    const proyectosByName = new Map<string, number>()
    for (const p of proyectos) proyectosByName.set(p.nombre.toLowerCase(), p.id)

    // Load existing factura numeros to detect duplicates
    const numerosCsv = rows
      .map((r) => r.numero?.trim())
      .filter((n): n is string => !!n)
    const existingFacturas = numerosCsv.length > 0
      ? await prisma.factura.findMany({
          where: { numero: { in: numerosCsv } },
          select: { numero: true },
        })
      : []
    const numerosExistentes = new Set(existingFacturas.map((f) => f.numero.toLowerCase()))

    // Validate every row
    const numerosEnLote = new Map<string, number>()
    const validated: ValidatedRow[] = rows.map((r, i) =>
      validateRow(r, i + 1, proyectosByName, numerosExistentes, numerosEnLote)
    )

    const valid = validated.filter((v) => v.ok)
    const invalid = validated.filter((v) => !v.ok)

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: validated.length,
        valid: valid.length,
        invalid: invalid.length,
        rows: validated,
      })
    }

    // Persist valid rows. We use a single transaction so a DB error rolls back
    // everything; the user can fix and retry.
    const created = await prisma.$transaction(
      valid.map((v) =>
        prisma.factura.create({
          data: {
            numero: v.data!.numero,
            ncf: v.data!.ncf,
            tipo: v.data!.tipo,
            fecha: v.data!.fecha,
            fechaVencimiento: v.data!.fechaVencimiento,
            proveedor: v.data!.proveedor,
            rncProveedor: v.data!.rncProveedor,
            destinoTipo: v.data!.destinoTipo,
            proyectoId: v.data!.proyectoId,
            descripcion: v.data!.descripcion,
            subtotal: v.data!.subtotal,
            impuesto: v.data!.impuesto,
            total: v.data!.total,
            observaciones: v.data!.observaciones,
            estado: 'pendiente',
          },
          select: { id: true, numero: true, proyectoId: true, total: true, fecha: true, descripcion: true, proveedor: true, ncf: true, destinoTipo: true },
        })
      )
    )

    // Auto-create gastos for facturas linked to a project (mirror of single-create flow)
    const conProyecto = created.filter((f) => f.proyectoId !== null)
    if (conProyecto.length > 0) {
      await prisma.gastoProyecto.createMany({
        data: conProyecto.map((f) => ({
          proyectoId: f.proyectoId!,
          destinoTipo: f.destinoTipo || 'proyecto',
          fecha: f.fecha,
          tipoGasto: 'Factura',
          referencia: `FAC-${f.numero}`,
          descripcion: f.descripcion || `Factura #${f.numero}`,
          suplidor: f.proveedor || null,
          monto: f.total,
          metodoPago: 'Factura',
          observaciones: f.ncf ? `NCF: ${f.ncf}` : null,
          facturaId: f.id,
        })),
      })
    }

    return NextResponse.json({
      dryRun: false,
      total: validated.length,
      valid: valid.length,
      invalid: invalid.length,
      created: created.length,
      rows: validated,
    })
  } catch (error) {
    console.error('Error importing facturas:', error)
    const message = error instanceof Error ? error.message : 'Error al importar facturas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
